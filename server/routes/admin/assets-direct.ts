import { Router } from 'express';
import { authenticateAdmin } from '../../middleware/auth';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import path from 'path';

const router = Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables:', {
    SUPABASE_URL: !!supabaseUrl,
    SUPABASE_SERVICE_KEY: !!supabaseServiceKey
  });
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });
    
    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload to storage', details: uploadError.message });
    }
    
    console.log('Upload successful:', uploadData);
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath);
    
    // Create asset record in database
    const { db } = await import('../../db');
    const { assets } = await import('@shared/schema');
    
    const [newAsset] = await db.insert(assets)
      .values({
        path: storagePath,
        bucket: bucket,
        status: 'active',
        type: 'item', // Use 'item' for all store items
        category: type, // Store the actual item type (avatar_hat, etc.) in category
        name: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        metadata: {
          originalName: req.file.originalname,
          uploadedBy: req.user?.id || 'admin',
          itemType: type // Also store in metadata for reference
        }
      })
      .returning();
    
    // Return response with both URL and assetId
    res.json({
      success: true,
      url: publicUrl,
      assetId: newAsset.id
    });
    
  } catch (error) {
    console.error('Asset upload error:', error);
    
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
      }
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to upload asset' });
  }
});

export default router;
