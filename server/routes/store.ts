import { Router } from 'express';
import { db } from '../db';
import { storeItems, insertStoreItemSchema, updateStoreItemSchema } from '../../shared/schema';
import { eq, asc, desc, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
const uuidv4 = () => crypto.randomUUID();
import fs from 'fs/promises';
import { authenticateAdmin } from '../middleware/auth';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // Save to backend's public directory
    const uploadDir = path.join(__dirname, '../../public/uploads/store-items');
    
    // Ensure directory exists
    try {
      await fs.mkdir(uploadDir, { recursive: true });
    } catch (error) {
      console.error('Error creating upload directory:', error);
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png, gif) are allowed'));
    }
  }
});

// Public endpoint: Get all active store items with pagination
router.get('/items', async (req, res) => {
  try {
    // Parse pagination parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50)); // Default 50, max 100
    const offset = (page - 1) * limit;
    
    // Optional filtering by item type
    const itemType = req.query.type as string;
    
    // Build query
    let query = db
      .select()
      .from(storeItems)
      .where(eq(storeItems.isActive, true));
    
    // Add type filter if provided
    if (itemType && ['avatar_hat', 'avatar_accessory', 'room_furniture', 'room_decoration', 'room_wallpaper', 'room_flooring'].includes(itemType)) {
      query = query.where(eq(storeItems.itemType, itemType));
    }
    
    // Get total count for pagination metadata
    const countResult = await db
      .select({ count: db.$count(storeItems) })
      .from(storeItems)
      .where(eq(storeItems.isActive, true));
    
    const totalItems = countResult[0]?.count || 0;
    const totalPages = Math.ceil(totalItems / limit);
    
    // Get paginated items
    const items = await query
      .orderBy(asc(storeItems.sortOrder), asc(storeItems.name))
      .limit(limit)
      .offset(offset);
    
    res.json({
      items,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching store items:', error);
    res.status(500).json({ error: 'Failed to fetch store items' });
  }
});

// Get all items without pagination (for admin tools that need full list)
router.get('/catalog', async (req, res) => {
  try {
    const items = await db
      .select()
      .from(storeItems)
      .where(eq(storeItems.isActive, true))
      .orderBy(asc(storeItems.sortOrder), asc(storeItems.name));
    
    res.json(items);
  } catch (error) {
    console.error('Error fetching store catalog:', error);
    res.status(500).json({ error: 'Failed to fetch store catalog' });
  }
});

// Get multiple items by IDs (for loading owned items)
router.post('/items/batch', async (req, res) => {
  try {
    const { itemIds } = req.body;
    
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.json([]);
    }
    
    // Limit to prevent abuse
    const limitedIds = itemIds.slice(0, 100);
    
    const items = await db
      .select()
      .from(storeItems)
      .where(inArray(storeItems.id, limitedIds));
    
    res.json(items);
  } catch (error) {
    console.error('Error fetching items by IDs:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Admin endpoints (all require authentication)

// Get all store items (including inactive)
router.get('/admin/items', authenticateAdmin, async (req, res) => {
  try {
    const items = await db
      .select()
      .from(storeItems)
      .orderBy(asc(storeItems.sortOrder), asc(storeItems.name));
    
    res.json(items);
  } catch (error) {
    console.error('Error fetching store items:', error);
    res.status(500).json({ error: 'Failed to fetch store items' });
  }
});

// Get a single store item
router.get('/admin/items/:id', authenticateAdmin, async (req, res) => {
  try {
    const item = await db
      .select()
      .from(storeItems)
      .where(eq(storeItems.id, req.params.id))
      .limit(1);
    
    if (item.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json(item[0]);
  } catch (error) {
    console.error('Error fetching store item:', error);
    res.status(500).json({ error: 'Failed to fetch store item' });
  }
});

// Create a new store item
router.post('/admin/items', authenticateAdmin, async (req, res) => {
  try {
    const validatedData = insertStoreItemSchema.parse(req.body);
    
    const newItem = await db
      .insert(storeItems)
      .values(validatedData)
      .returning();
    
    res.status(201).json(newItem[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error creating store item:', error);
    res.status(500).json({ error: 'Failed to create store item' });
  }
});

// Update a store item
router.put('/admin/items/:id', authenticateAdmin, async (req, res) => {
  try {
    const validatedData = updateStoreItemSchema.parse(req.body);
    
    const updatedItem = await db
      .update(storeItems)
      .set({
        ...validatedData,
        updatedAt: new Date()
      })
      .where(eq(storeItems.id, req.params.id))
      .returning();
    
    if (updatedItem.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json(updatedItem[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error updating store item:', error);
    res.status(500).json({ error: 'Failed to update store item' });
  }
});

// Delete a store item (soft delete by setting isActive = false)
router.delete('/admin/items/:id', authenticateAdmin, async (req, res) => {
  try {
    const updatedItem = await db
      .update(storeItems)
      .set({
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(storeItems.id, req.params.id))
      .returning();
    
    if (updatedItem.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting store item:', error);
    res.status(500).json({ error: 'Failed to delete store item' });
  }
});

// Upload image endpoint
router.post('/admin/upload/store-image', authenticateAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    // Return the public URL for the uploaded image
    const imageUrl = `/uploads/store-items/${req.file.filename}`;
    
    res.json({ imageUrl });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

export default router;
