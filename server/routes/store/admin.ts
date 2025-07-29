// Store Admin Routes - Database-driven store management
import type { Express } from "express";
import { z } from "zod";
import { db } from "../../db";
import { storeItems, itemTypes, patterns } from "@shared/schema";
import { eq, desc, asc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { validateUUID } from "../../middleware/validateUUID";
import multer from "multer";
import StorageRouter from "../../services/storage-router";
import { getCache } from "../../lib/cache-factory";

const cache = getCache();

// Cache configuration - must match store.ts
const CATALOG_CACHE_KEY = 'store:catalog:active';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
      return;
    }
    cb(null, true);
  }
});

// Validation schemas
const createItemSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  itemType: z.enum([
    'avatar_hat',
    'avatar_accessory', 
    'room_furniture',
    'room_decoration',
    'room_wallpaper',
    'room_flooring'
  ]),
  cost: z.number().int().min(0),
  rarity: z.enum(['common', 'rare', 'epic', 'legendary']).default('common'),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  assetType: z.enum(['image', 'rive']).optional(),
  thumbnailUrl: z.string().optional(),
  riveUrl: z.string().optional()
});

const updateItemSchema = createItemSchema.partial();

export function registerStoreAdminRoutes(app: Express) {
  
  // Get all store items (admin view)
  app.get("/api/store/admin/items", requireAuth, requireAdmin, async (req, res) => {
    console.log('🔍 ADMIN STORE ITEMS REQUEST RECEIVED');
    console.log('Auth header:', req.headers.authorization);
    console.log('User from request:', req.user);
    console.log('Profile from request:', req.profile);
    try {
      const items = await db
        .select({
          id: storeItems.id,
          name: storeItems.name,
          description: storeItems.description,
          itemTypeId: storeItems.itemTypeId,
          itemType: itemTypes.code,
          cost: storeItems.cost,
          rarity: storeItems.rarity,
          isActive: storeItems.isActive,
          sortOrder: storeItems.sortOrder,
          assetId: storeItems.assetId,
          assetType: storeItems.assetType,
          thumbnailUrl: storeItems.thumbnailUrl, // ADD THIS LINE
          createdAt: storeItems.createdAt,
          updatedAt: storeItems.updatedAt
        })
        .from(storeItems)
        .leftJoin(itemTypes, eq(storeItems.itemTypeId, itemTypes.id))
        .orderBy(desc(storeItems.createdAt));
      
      console.log('=== ADMIN STORE ITEMS DEBUG ===');
      console.log('Raw items from DB:', items.length);
      console.log('First item:', JSON.stringify(items[0], null, 2));
      
      // Prepare items with proper image URLs
      const preparedItems = await StorageRouter.prepareStoreItemsResponse(items);
      
      console.log('Prepared items:', preparedItems.length);
      console.log('First prepared item:', JSON.stringify(preparedItems[0], null, 2));
      
      res.json(preparedItems);
    } catch (error) {
      console.error("Get store items error:", error);
      res.status(500).json({ message: "Failed to get store items" });
    }
  });
  
  // Create new store item
  app.post("/api/store/admin/items", requireAuth, requireAdmin, async (req, res) => {
    console.log('🚀 HIT CREATE STORE ITEM ENDPOINT');
    try {
      console.log('=== CREATE STORE ITEM REQUEST ===');
      console.log('Request body:', req.body);
      console.log('Raw itemType from frontend:', req.body.itemType);
      console.log('Valid enum values:', ['avatar_hat', 'avatar_accessory', 'room_furniture', 'room_decoration', 'room_wallpaper', 'room_flooring']);
      
      let validatedData;
      try {
        validatedData = createItemSchema.parse(req.body);
        console.log('Validation passed, data:', validatedData);
      } catch (validationError) {
        console.log('VALIDATION FAILED:', validationError);
        if (validationError instanceof z.ZodError) {
          console.log('Validation errors:', validationError.errors);
        }
        throw validationError;
      }
      
      // Get assetId and URLs from request body
      const assetId = req.body.assetId;
      const imageUrl = req.body.imageUrl;
      const thumbnailUrl = req.body.thumbnailUrl; // This now comes from the upload response
      const assetType = req.body.assetType || 'image';
      const riveUrl = req.body.riveUrl;
      
      // For wallpaper and flooring, asset ID is optional since they can use patterns
      const isPatternItem = ['room_wallpaper', 'room_flooring'].includes(validatedData.itemType);
      
      // Ensure we have an assetId for non-pattern items
      if (!assetId && !isPatternItem) {
        return res.status(400).json({ 
          message: "Asset ID is required. Please upload an asset first." 
        });
      }
      
      // Validate assetId is a UUID if provided
      if (assetId) {
        const assetIdValidation = z.string().uuid().safeParse(assetId);
        if (!assetIdValidation.success) {
          return res.status(400).json({ 
            message: "Invalid asset ID format" 
          });
        }
      }
      
      // Look up the item type UUID from the code sent by frontend
      const itemTypeCode = validatedData.itemType; // This is like "avatar_hat"
      console.log('=== ITEM TYPE LOOKUP ===');
      console.log('Frontend sent itemType:', itemTypeCode);
      console.log('Looking for code in database:', itemTypeCode);
      
      const [itemType] = await db
        .select()
        .from(itemTypes)
        .where(eq(itemTypes.code, itemTypeCode))
        .limit(1);
      
      console.log('Found item type in DB:', itemType);
      console.log('Item type ID found:', itemType?.id || 'NOT FOUND');
      
      if (!itemType) {
        return res.status(400).json({ 
          message: `Invalid item type: ${itemTypeCode}` 
        });
      }
      
      // For pattern items (wallpaper/flooring), create a pattern record first
      let patternId = null;
      if (isPatternItem && imageUrl) {
        // Generate a unique pattern code
        const patternPrefix = itemTypeCode === 'room_wallpaper' ? 'wallpaper' : 'flooring';
        const patternCode = `${patternPrefix}_${validatedData.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
        
        // Determine surface type based on item type
        const surfaceType = itemTypeCode === 'room_wallpaper' ? 'background' : 'texture';
        
        console.log('Creating pattern record:', {
          code: patternCode,
          surfaceType,
          imageUrl
        });
        
        // Create pattern record
        const [pattern] = await db
          .insert(patterns)
          .values({
            code: patternCode,
            name: validatedData.name,
            description: validatedData.description || null,
            surfaceType: surfaceType,
            patternType: 'image', // Since we're using uploaded images
            patternValue: imageUrl, // The image URL
            theme: null, // Can be set later if needed
            thumbnailUrl: thumbnailUrl || imageUrl, // Use thumbnail or fall back to main image
            isActive: validatedData.isActive,
          })
          .returning();
          
        patternId = pattern.id;
        console.log('Created pattern with ID:', patternId);
      }
      
      // Now create the store item with the asset ID and new fields
      const [newItem] = await db
        .insert(storeItems)
        .values({
          name: validatedData.name,
          description: validatedData.description || null,
          itemTypeId: itemType.id, // Use the UUID from item_types table
          cost: validatedData.cost,
          rarity: validatedData.rarity,
          isActive: validatedData.isActive ?? true, // Force true if undefined
          sortOrder: validatedData.sortOrder,
          assetId: assetId || null, // Use the asset ID if provided
          assetType: assetType, // image or rive
          thumbnailUrl: thumbnailUrl || null, // Save thumbnail URL
          patternId: patternId, // Link to pattern if this is a pattern item
        })
        .returning();
      
      // Clear store catalog cache
      await cache.del(CATALOG_CACHE_KEY);
      console.log('🗑️ Cleared store catalog cache after creating item');
      
      res.json(newItem);
    } catch (error) {
      console.error("Create store item error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create store item" });
      }
    }
  });
  
  // Update store item
  app.put("/api/store/admin/items/:id", requireAuth, requireAdmin, validateUUID('id'), async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateItemSchema.parse(req.body);
      
      // Handle additional fields in update
      const updateData: any = { ...validatedData, updatedAt: new Date() };
      if (req.body.imageUrl !== undefined) {
        updateData.imageUrl = req.body.imageUrl;
      }
      if (req.body.thumbnailUrl !== undefined) {
        updateData.thumbnailUrl = req.body.thumbnailUrl;
      }
      if (req.body.assetType !== undefined) {
        updateData.assetType = req.body.assetType;
      }
      if (req.body.riveUrl !== undefined) {
        updateData.riveUrl = req.body.riveUrl;
      }
      
      const [updatedItem] = await db
        .update(storeItems)
        .set(updateData)
        .where(eq(storeItems.id, id))
        .returning();
      
      if (!updatedItem) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      // Clear store catalog cache
      await cache.del(CATALOG_CACHE_KEY);
      console.log('🗑️ Cleared store catalog cache after updating item');
      
      res.json(updatedItem);
    } catch (error) {
      console.error("Update store item error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update store item" });
      }
    }
  });
  
  // Delete store item
  app.delete("/api/store/admin/items/:id", requireAuth, requireAdmin, validateUUID('id'), async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get item to check if it has an image
      const [item] = await db
        .select()
        .from(storeItems)
        .where(eq(storeItems.id, id))
        .limit(1);
      
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      // Delete associated asset FIRST if it exists
      if (item.assetId) {
        try {
          // Handle deletion
          await StorageRouter.deleteFile(item.assetId);
        } catch (error: any) {
          console.error(`Failed to delete asset ${item.assetId} for store item ${id}:`, error);
          
          // If cloud storage is not enabled, just log and continue
          if (error.message && error.message.includes('Cloud storage is not enabled')) {
            console.log('Cloud storage not enabled, skipping asset deletion');
          } else {
            // For other errors, return an error WITHOUT deleting the DB record
            return res.status(500).json({ 
              message: "Failed to delete associated image asset. Database record was not deleted.",
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }
      
      // If asset deletion was successful (or not needed), delete from database
      await db
        .delete(storeItems)
        .where(eq(storeItems.id, id));
      
      // Clear store catalog cache
      await cache.del(CATALOG_CACHE_KEY);
      console.log('🗑️ Cleared store catalog cache after deleting item');
      
      res.json({ message: "Item and associated asset deleted successfully" });
    } catch (error) {
      console.error("Delete store item error:", error);
      res.status(500).json({ message: "Failed to delete store item" });
    }
  });
  
  // Upload store item image
  app.post(
    "/api/store/admin/upload/store-image", 
    requireAuth, 
    requireAdmin,
    upload.single('image'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No image file provided" });
        }
        
        // Upload to Supabase Storage
        const { url, path } = await StorageRouter.uploadFile(
          req.file.buffer,
          req.file.originalname,
          {
            bucket: 'store-items',
            folder: 'uploads',
            type: 'item',
            mimeType: req.file.mimetype
          }
        );
        
        res.json({ 
          imageUrl: url,
          path: path,
          message: "Image uploaded successfully" 
        });
      } catch (error) {
        console.error("Image upload error:", error);
        res.status(500).json({ message: "Failed to upload image" });
      }
    }
  );
  
  // Note: Public catalog endpoint is in the main store router at /api/store/catalog
}
