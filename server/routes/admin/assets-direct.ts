import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import path from 'path';
import sharp from 'sharp';
import { db } from '../../db';
import { sql } from 'drizzle-orm';

const router = Router();

// Supabase client will be initialized on first use
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables:', {
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !!supabaseServiceKey
      });
      throw new Error('Missing Supabase environment variables. Please check your .env file.');
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabase;
}

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type based on field name
    if (file.fieldname === 'thumbnail') {
      // Thumbnails must be images
      const allowedImageMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (allowedImageMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Thumbnail must be an image (JPEG, PNG, GIF, or WebP).'));
      }
    } else {
      // Main asset can be image or RIVE
      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/octet-stream'];
      const ext = path.extname(file.originalname).toLowerCase();
      
      // Special handling for .riv files
      if (ext === '.riv' || allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Images (JPEG, PNG, GIF, WebP) or RIVE (.riv) files are allowed.'));
      }
    }
  },
});

/**
 * Generate a thumbnail from an image buffer
 */
async function generateThumbnail(buffer: Buffer, size: number = 128): Promise<Buffer> {
  return sharp(buffer)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
}

/**
 * POST /api/admin/assets/upload
 * Enhanced upload endpoint that supports images and RIVE files with automatic thumbnail generation
 */
router.post('/upload', requireAuth, requireAdmin, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), async (req: any, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const mainFile = files['image']?.[0];
    const thumbnailFile = files['thumbnail']?.[0];
    
    if (!mainFile) {
      return res.status(400).json({ error: 'No main file uploaded' });
    }

    const { type, assetType, storeItemId } = req.body;
    if (!type) {
      return res.status(400).json({ error: 'Item type is required' });
    }
    
    // Determine if this is a RIVE file
    const ext = path.extname(mainFile.originalname).toLowerCase();
    const isRive = ext === '.riv';
    const actualAssetType = isRive ? 'rive' : 'static';
    
    // Use provided storeItemId or generate a new one
    const itemId = storeItemId || crypto.randomUUID();
    
    // Create folder structure: items/{itemId}/
    const folderPath = `items/${itemId}`;
    const mainFileName = isRive ? 'main.riv' : 'main.png';
    const mainPath = `${folderPath}/${mainFileName}`;
    const thumbPath = `${folderPath}/thumb.png`;
    
    // Upload to Supabase Storage
    const bucket = 'store-items';
    let mainBuffer = mainFile.buffer;
    let thumbnailBuffer: Buffer;
    
    // Process main file if it's an image (convert to PNG)
    if (!isRive) {
      mainBuffer = await sharp(mainFile.buffer).png().toBuffer();
    }
    
    // Handle thumbnail
    if (isRive) {
      // For RIVE files, thumbnail is required
      if (!thumbnailFile) {
        return res.status(400).json({ error: 'Thumbnail is required for RIVE animations' });
      }
      thumbnailBuffer = await generateThumbnail(thumbnailFile.buffer);
    } else {
      // For images, generate thumbnail automatically
      thumbnailBuffer = await generateThumbnail(mainFile.buffer);
    }
    
    console.log('Uploading to Supabase:', { bucket, mainPath, thumbPath });
    
    // Upload main file
    const { data: mainUploadData, error: mainUploadError } = await getSupabaseClient().storage
      .from(bucket)
      .upload(mainPath, mainBuffer, {
        contentType: isRive ? 'application/octet-stream' : 'image/png',
        upsert: true,
      });
    
    if (mainUploadError) {
      console.error('Main file upload error:', mainUploadError);
      
      // Check if it's a bucket not found error
      if (mainUploadError.message?.includes('The resource was not found')) {
        return res.status(500).json({ 
          error: 'Storage bucket not found', 
          details: 'The "store-items" bucket does not exist in Supabase. Please create it in your Supabase dashboard under Storage.' 
        });
      }
      
      return res.status(500).json({ error: 'Failed to upload main file', details: mainUploadError.message });
    }
    
    // Upload thumbnail
    const { data: thumbUploadData, error: thumbUploadError } = await getSupabaseClient().storage
      .from(bucket)
      .upload(thumbPath, thumbnailBuffer, {
        contentType: 'image/png',
        upsert: true,
      });
    
    if (thumbUploadError) {
      console.error('Thumbnail upload error:', thumbUploadError);
      // Try to clean up the main file
      await getSupabaseClient().storage.from(bucket).remove([mainPath]);
      return res.status(500).json({ error: 'Failed to upload thumbnail', details: thumbUploadError.message });
    }
    
    console.log('Upload successful:', { main: mainUploadData, thumb: thumbUploadData });
    
    // Get public URLs
    const { data: { publicUrl: mainUrl } } = getSupabaseClient().storage
      .from(bucket)
      .getPublicUrl(mainPath);
      
    const { data: { publicUrl: thumbnailUrl } } = getSupabaseClient().storage
      .from(bucket)
      .getPublicUrl(thumbPath);
    
    // Create asset record in database using raw SQL with proper result handling
    const assetId = crypto.randomUUID();
    const result = await db.execute(sql`
      INSERT INTO assets (id, file_name, file_type, file_size, storage_path, public_url, category, created_at, updated_at)
      VALUES (${assetId}, ${mainFile.originalname}, ${mainFile.mimetype}, ${mainFile.size}, ${mainPath}, ${mainUrl}, ${type}, NOW(), NOW())
    `);
    
    const newAsset = { id: assetId };
    
    // Return response with URLs, assetId, and asset type info
    res.json({
      success: true,
      url: mainUrl,
      thumbnailUrl: thumbnailUrl,
      assetId: newAsset.id,
      assetType: actualAssetType,
      storeItemId: itemId
    });
    
  } catch (error: any) {
    console.error('Asset upload error:', error);
    console.error('Error stack:', error.stack);
    
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
      }
      return res.status(400).json({ error: error.message });
    }
    
    // If it's the missing env vars error, return a specific message
    if (error.message?.includes('Missing Supabase environment variables')) {
      return res.status(500).json({ 
        error: 'Server configuration error', 
        details: 'Supabase is not properly configured on the server. Please contact the administrator.'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to upload asset',
      details: error.message || 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/admin/assets/test-connection
 * Test Supabase connection and configuration
 */
router.get('/test-connection', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Test environment variables
    const envCheck = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      USE_CLOUD_STORAGE: process.env.USE_CLOUD_STORAGE
    };
    
    // Try to initialize client
    let clientStatus = 'Not initialized';
    let bucketCheck = null;
    
    try {
      const client = getSupabaseClient();
      clientStatus = 'Initialized successfully';
      
      // Try to list buckets
      const { data: buckets, error: listError } = await client.storage.listBuckets();
      if (listError) {
        bucketCheck = { error: listError.message };
      } else {
        bucketCheck = {
          buckets: buckets?.map(b => b.name) || [],
          hasStoreItems: buckets?.some(b => b.name === 'store-items') || false
        };
      }
    } catch (initError: any) {
      clientStatus = `Failed: ${initError.message}`;
    }
    
    res.json({
      success: true,
      environment: envCheck,
      supabaseClient: clientStatus,
      storage: bucketCheck,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
