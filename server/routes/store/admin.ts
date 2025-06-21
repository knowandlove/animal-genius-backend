// Store Admin Routes - Database-driven store management
import type { Express } from "express";
import { db } from "../../db";
import { storeItems } from "@shared/schema";
import { eq, desc, asc } from "drizzle-orm";
import { requireAuth, authenticateAdmin as requireAdmin } from "../../middleware/auth";
import { z } from "zod";
import multer from "multer";
import StorageService from "../../services/storage-service";

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
  rarity: z.enum(['common', 'rare', 'legendary']).default('common'),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0)
});

const updateItemSchema = createItemSchema.partial();

export function registerStoreAdminRoutes(app: Express) {
  
  // Get all store items (admin view)
  app.get("/api/store/admin/items", requireAuth, requireAdmin, async (req, res) => {
    try {
      const items = await db
        .select()
        .from(storeItems)
        .orderBy(desc(storeItems.createdAt));
      
      res.json(items);
    } catch (error) {
      console.error("Get store items error:", error);
      res.status(500).json({ message: "Failed to get store items" });
    }
  });
  
  // Create new store item
  app.post("/api/store/admin/items", requireAuth, requireAdmin, async (req, res) => {
    try {
      const validatedData = createItemSchema.parse(req.body);
      
      // Get assetId from request body (required)
      const assetId = req.body.assetId;
      const imageUrl = req.body.imageUrl;
      
      // Ensure we have an assetId (required by schema)
      if (!assetId) {
        return res.status(400).json({ 
          message: "Asset ID is required. Please upload an image first." 
        });
      }
      
      // Now create the store item with the asset ID
      const [newItem] = await db
        .insert(storeItems)
        .values({
          ...validatedData,
          name: validatedData.name,
          description: validatedData.description || null,
          itemType: validatedData.itemType,
          cost: validatedData.cost,
          rarity: validatedData.rarity,
          isActive: validatedData.isActive,
          sortOrder: validatedData.sortOrder,
          assetId: assetId, // Use the asset ID
          imageUrl: imageUrl || null // Keep for feature flag compatibility
        })
        .returning();
      
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
  app.put("/api/store/admin/items/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateItemSchema.parse(req.body);
      
      // If imageUrl is provided, include it in the update
      const updateData: any = { ...validatedData, updatedAt: new Date() };
      if (req.body.imageUrl !== undefined) {
        updateData.imageUrl = req.body.imageUrl;
      }
      
      const [updatedItem] = await db
        .update(storeItems)
        .set(updateData)
        .where(eq(storeItems.id, id))
        .returning();
      
      if (!updatedItem) {
        return res.status(404).json({ message: "Item not found" });
      }
      
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
  app.delete("/api/store/admin/items/:id", requireAuth, requireAdmin, async (req, res) => {
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
          // Import StorageRouter to handle deletion
          const StorageRouter = (await import('../../services/storage-router')).default;
          await StorageRouter.deleteFile(item.assetId);
        } catch (error) {
          console.error(`Failed to delete asset ${item.assetId} for store item ${id}:`, error);
          // Return an error WITHOUT deleting the DB record, so the operation can be retried
          return res.status(500).json({ 
            message: "Failed to delete associated image asset. Database record was not deleted.",
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      // If asset deletion was successful (or not needed), delete from database
      await db
        .delete(storeItems)
        .where(eq(storeItems.id, id));
      
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
        const { url, path } = await StorageService.uploadImage(req.file, {
          bucket: 'store-uploads',
          optimize: true,
          maxWidth: 800,
          maxHeight: 800
        });
        
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
