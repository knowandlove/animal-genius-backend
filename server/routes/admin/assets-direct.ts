import { Router } from 'express';
import { authenticateAdmin } from '../../middleware/auth';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import path from 'path';

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
    // Check file type
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  },
});

/**
 * POST /api/admin/assets/upload
 * Simple upload endpoint that returns a URL directly
 */
router.post('/upload', authenticateAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { type } = req.body;
    if (!type) {
      return res.status(400).json({ error: 'Item type is required' });
    }
    
    // Generate unique path
    const timestamp = Date.now();
    const randomId = crypto.randomUUID();
    const ext = path.extname(req.file.originalname);
    const safeName = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9-]/g, '_');
    const storagePath = `${type}/${randomId}-${timestamp}-${safeName}${ext}`;
    
    // Upload to Supabase Storage
    const bucket = 'store-items';
    console.log('Uploading to Supabase:', { bucket, storagePath, size: req.file.size });
    
    const { data: uploadData, error: uploadError } = await getSupabaseClient().storage
      .from(bucket)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });
    
    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      
      // Check if it's a bucket not found error
      if (uploadError.message?.includes('The resource was not found')) {
        return res.status(500).json({ 
          error: 'Storage bucket not found', 
          details: 'The "store-items" bucket does not exist in Supabase. Please create it in your Supabase dashboard under Storage.' 
        });
      }
      
      return res.status(500).json({ error: 'Failed to upload to storage', details: uploadError.message });
    }
    
    console.log('Upload successful:', uploadData);
    
    // Get public URL
    const { data: { publicUrl } } = getSupabaseClient().storage
      .from(bucket)
      .getPublicUrl(storagePath);
    
    // Create asset record in database using raw SQL with proper result handling
    const { db } = await import('../../db');
    const { sql } = await import('drizzle-orm');
    
    const assetId = crypto.randomUUID();
    const result = await db.execute(sql`
      INSERT INTO assets (id, file_name, file_type, file_size, storage_path, public_url, category, created_at, updated_at)
      VALUES (${assetId}, ${req.file.originalname}, ${req.file.mimetype}, ${req.file.size}, ${storagePath}, ${publicUrl}, ${type}, NOW(), NOW())
    `);
    
    const newAsset = { id: assetId };
    
    // Return response with both URL and assetId
    res.json({
      success: true,
      url: publicUrl,
      assetId: newAsset.id
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
router.get('/test-connection', authenticateAdmin, async (req, res) => {
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
