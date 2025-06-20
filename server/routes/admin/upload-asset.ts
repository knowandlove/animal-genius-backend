import { Router } from 'express';
import { authenticateAdmin } from '../../middleware/auth';
import StorageRouter from '../../services/storage-router';
import multer from 'multer';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import sharp from 'sharp';

const router = Router();

// Rate limiting for upload endpoint
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 uploads per window
  message: 'Too many upload attempts, please try again later',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only safe image formats
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  }
});

// Request validation schema
const uploadAssetSchema = z.object({
  type: z.enum(['animal', 'item', 'ui', 'user']).default('item'),
  category: z.string().regex(/^[a-zA-Z0-9-_]+$/, 'Category can only contain letters, numbers, hyphens, and underscores').optional(),
  itemType: z.string().regex(/^[a-zA-Z0-9-_]+$/, 'Item type can only contain letters, numbers, hyphens, and underscores').optional(), // For store items
  name: z.string().optional(),
  bucket: z.enum(['public-assets', 'store-items', 'user-generated']).default('store-items')
});

/**
 * POST /api/admin/upload-asset
 * Upload an asset securely through the backend
 * 
 * Body (multipart/form-data):
 * - file: The image file to upload
 * - type: 'animal' | 'item' | 'ui' | 'user'
 * - category: Category for organization (e.g., 'hats', 'furniture')
 * - itemType: For store items (alias for category)
 * - name: Display name for the asset
 * - bucket: Target bucket (defaults to 'store-items')
 */
router.post('/upload-asset', authenticateAdmin, uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }

    // Validate request body
    const validationResult = uploadAssetSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid request data',
        details: validationResult.error.errors 
      });
    }

    const { type, category, itemType, name, bucket } = validationResult.data;

    // Validate image dimensions
    try {
      const metadata = await sharp(req.file.buffer).metadata();
      if (metadata.width && metadata.width > 4096) {
        return res.status(400).json({ 
          success: false, 
          error: 'Image width exceeds maximum of 4096 pixels' 
        });
      }
      if (metadata.height && metadata.height > 4096) {
        return res.status(400).json({ 
          success: false, 
          error: 'Image height exceeds maximum of 4096 pixels' 
        });
      }
    } catch (sharpError) {
      console.error('Image validation error:', sharpError);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid image file' 
      });
    }

    // Log upload attempt
    console.log('Admin upload request:', {
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      type,
      category: category || itemType,
      bucket,
      cloudStorageEnabled: StorageRouter.isCloudStorageEnabled()
    });

    // Upload using storage router (respects feature flag)
    const uploadResult = await StorageRouter.uploadFile(
      req.file.buffer,
      req.file.originalname,
      {
        bucket,
        folder: category || itemType || 'misc',
        type,
        category: category || itemType,
        itemType,
        name: name || req.file.originalname
      }
    );

    // Prepare response
    const response = {
      success: true,
      url: uploadResult.url,
      assetId: uploadResult.assetId,
      cloudStorage: StorageRouter.isCloudStorageEnabled(),
      // Include additional info for debugging
      ...(process.env.NODE_ENV === 'development' && {
        path: uploadResult.path,
        bucket,
        type,
        category: category || itemType
      })
    };

    console.log('Upload successful:', response);
    res.json(response);

  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Upload failed',
      // Include stack trace in development
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack
      })
    });
  }
});

/**
 * DELETE /api/admin/delete-asset/:assetId
 * Delete an asset (only for cloud storage)
 */
router.delete('/delete-asset/:assetId', authenticateAdmin, async (req, res) => {
  try {
    const { assetId } = req.params;

    if (!StorageRouter.isCloudStorageEnabled()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Asset deletion only available with cloud storage' 
      });
    }

    await StorageRouter.deleteFile(assetId);

    res.json({ 
      success: true, 
      message: 'Asset deleted successfully' 
    });

  } catch (error: any) {
    console.error('Delete error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Delete failed' 
    });
  }
});

/**
 * GET /api/admin/storage-stats
 * Get storage usage statistics
 */
router.get('/storage-stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = await StorageRouter.getStorageStats();
    
    res.json({
      success: true,
      cloudStorageEnabled: StorageRouter.isCloudStorageEnabled(),
      stats
    });

  } catch (error: any) {
    console.error('Stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get stats' 
    });
  }
});

/**
 * GET /api/admin/storage-status
 * Check storage configuration and feature flag status
 */
router.get('/storage-status', authenticateAdmin, async (req, res) => {
  const status = {
    cloudStorageEnabled: StorageRouter.isCloudStorageEnabled(),
    supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY),
    featureFlag: process.env.USE_CLOUD_STORAGE,
    buckets: ['public-assets', 'store-items', 'user-generated'],
    environment: process.env.NODE_ENV
  };

  res.json(status);
});

export default router;
