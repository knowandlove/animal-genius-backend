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
          imageUrl: req.body.imageUrl || null // Image URL from separate upload
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
      
      // Delete from database
      await db
        .delete(storeItems)
        .where(eq(storeItems.id, id));
      
      // Delete image from Supabase if it exists
      if (item.imageUrl && item.imageUrl.includes('supabase')) {
        try {
          // Extract path from URL
          const url = new URL(item.imageUrl);
          const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
          if (pathMatch) {
            const [, bucket, path] = pathMatch;
            await StorageService.deleteImage(bucket, path);
          }
        } catch (error) {
          console.error('Failed to delete image:', error);
          // Continue even if image deletion fails
        }
      }
      
      res.json({ message: "Item deleted successfully" });
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
  
  // Get active store items (public endpoint for students)
  app.get("/api/store/catalog", async (req, res) => {
    try {
      const items = await db
        .select({
          id: storeItems.id,
          name: storeItems.name,
          type: storeItems.itemType,
          cost: storeItems.cost,
          description: storeItems.description,
          rarity: storeItems.rarity,
          imageUrl: storeItems.imageUrl
        })
        .from(storeItems)
        .where(eq(storeItems.isActive, true))
        .orderBy(asc(storeItems.sortOrder), asc(storeItems.name));
      
      res.json(items);
    } catch (error) {
      console.error("Get store catalog error:", error);
      res.status(500).json({ message: "Failed to get store catalog" });
    }
  });
}
