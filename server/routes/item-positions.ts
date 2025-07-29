import type { Express, Request, Response } from "express";
import { AuthenticatedRequest } from "../types/api";
import { db } from "../db";
import { itemAnimalPositions, profiles, itemTypes, animalTypes } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

export function registerItemPositionRoutes(app: Express) {
  // Public endpoint to get item positions (for avatar display)
  app.get("/api/item-positions", async (_req, res) => {
    try {
      const positions = await db
        .select({
          item_type: itemTypes.code,
          animal_type: animalTypes.code,
          x_position: itemAnimalPositions.xPosition,
          y_position: itemAnimalPositions.yPosition,
          scale: itemAnimalPositions.scale,
          rotation: itemAnimalPositions.rotation
        })
        .from(itemAnimalPositions)
        .leftJoin(itemTypes, eq(itemAnimalPositions.itemTypeId, itemTypes.id))
        .leftJoin(animalTypes, eq(itemAnimalPositions.animalTypeId, animalTypes.id));
      
      res.json(positions);
    } catch (error) {
      console.error("Get item positions error:", error);
      res.status(500).json({ message: "Failed to get item positions" });
    }
  });

  // Get all item positions (for matrix view)
  app.get("/api/admin/item-positions", requireAuth, async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      // Get user details to verify admin access
      const [user] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, authReq.user.userId))
        .limit(1);

      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const positions = await db.select().from(itemAnimalPositions);
      res.json(positions);
    } catch (error) {
      console.error("Get item positions error:", error);
      res.status(500).json({ message: "Failed to get item positions" });
    }
  });

  // Save/update item position
  app.post("/api/admin/item-positions", requireAuth, async (_req, res) => {
    const authReq = req as AuthenticatedRequest;
    console.log('=== SAVE ITEM POSITION REQUEST ===');
    console.log('Request body:', authReq.body);
    
    try {
      // Get user details to verify admin access
      const [user] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, authReq.user.userId))
        .limit(1);

      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { item_type, animal_type, x_position, y_position, scale, rotation } = authReq.body;
      console.log('Parsed values:', { item_type, animal_type, x_position, y_position, scale, rotation });

      // Validate input
      if (!item_type || !animal_type) {
        return res.status(400).json({ message: "Item type and animal type are required" });
      }

      // Look up the UUIDs for item type and animal type
      const [itemTypeRecord] = await db
        .select()
        .from(itemTypes)
        .where(eq(itemTypes.code, item_type))
        .limit(1);
        
      const [animalTypeRecord] = await db
        .select()
        .from(animalTypes)
        .where(eq(animalTypes.code, animal_type))
        .limit(1);
        
      if (!itemTypeRecord || !animalTypeRecord) {
        return res.status(400).json({ 
          message: "Invalid item type or animal type",
          details: {
            itemTypeFound: !!itemTypeRecord,
            animalTypeFound: !!animalTypeRecord
          }
        });
      }

      console.log('Found UUIDs:', {
        itemTypeId: itemTypeRecord.id,
        animalTypeId: animalTypeRecord.id
      });

      // Check if position exists
      const [existing] = await db
        .select()
        .from(itemAnimalPositions)
        .where(
          and(
            eq(itemAnimalPositions.itemTypeId, itemTypeRecord.id),
            eq(itemAnimalPositions.animalTypeId, animalTypeRecord.id)
          )
        )
        .limit(1);

      if (existing) {
        // Update existing position
        const [updated] = await db
          .update(itemAnimalPositions)
          .set({
            xPosition: x_position?.toString() ?? '50',
            yPosition: y_position?.toString() ?? '50',
            scale: (scale / 100)?.toString() ?? '1.0',
            rotation: rotation ?? 0,
            updatedAt: new Date()
          })
          .where(eq(itemAnimalPositions.id, existing.id))
          .returning();

        res.json(updated);
      } else {
        // Create new position
        const [created] = await db
          .insert(itemAnimalPositions)
          .values({
            itemTypeId: itemTypeRecord.id,
            animalTypeId: animalTypeRecord.id,
            xPosition: x_position?.toString() ?? '50',
            yPosition: y_position?.toString() ?? '50',
            scale: (scale / 100)?.toString() ?? '1.0',
            rotation: rotation ?? 0
          })
          .returning();

        res.json(created);
      }
    } catch (error) {
      console.error("Save item position error:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(500).json({ message: "Failed to save item position" });
    }
  });

  // Bulk copy positions from one animal to others
  app.post("/api/admin/item-positions/bulk-copy", requireAuth, async (_req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
      // Get user details to verify admin access
      const [user] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, authReq.user.userId))
        .limit(1);

      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { item_type, source_animal, target_animals } = authReq.body;

      if (!item_type || !source_animal || !Array.isArray(target_animals)) {
        return res.status(400).json({ message: "Invalid request data" });
      }

      // Get source position
      const [sourcePosition] = await db
        .select()
        .from(itemAnimalPositions)
        .where(
          and(
            eq(itemAnimalPositions.itemTypeId, item_type),
            eq(itemAnimalPositions.animalTypeId, source_animal)
          )
        )
        .limit(1);

      if (!sourcePosition) {
        return res.status(404).json({ message: "Source position not found" });
      }

      // Copy to target animals
      const results = [];
      for (const targetAnimal of target_animals) {
        // Check if position exists for target
        const [existing] = await db
          .select()
          .from(itemAnimalPositions)
          .where(
            and(
              eq(itemAnimalPositions.itemTypeId, item_type),
              eq(itemAnimalPositions.animalTypeId, targetAnimal)
            )
          )
          .limit(1);

        if (existing) {
          // Update existing
          const [updated] = await db
            .update(itemAnimalPositions)
            .set({
              xPosition: sourcePosition.xPosition,
              yPosition: sourcePosition.yPosition,
              scale: sourcePosition.scale,
              rotation: sourcePosition.rotation,
              updatedAt: new Date()
            })
            .where(eq(itemAnimalPositions.id, existing.id))
            .returning();
          results.push(updated);
        } else {
          // Create new
          const [created] = await db
            .insert(itemAnimalPositions)
            .values({
              itemTypeId: item_type,
              animalTypeId: targetAnimal,
              xPosition: sourcePosition.xPosition,
              yPosition: sourcePosition.yPosition,
              scale: sourcePosition.scale,
              rotation: sourcePosition.rotation
            })
            .returning();
          results.push(created);
        }
      }

      res.json({ copied: results.length, positions: results });
    } catch (error) {
      console.error("Bulk copy positions error:", error);
      res.status(500).json({ message: "Failed to copy positions" });
    }
  });

  // Batch update positions
  app.post("/api/admin/item-positions/batch", requireAuth, async (_req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
      // Get user details to verify admin access
      const [user] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, authReq.user.userId))
        .limit(1);

      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { positions } = authReq.body;

      if (!positions || typeof positions !== 'object') {
        return res.status(400).json({ message: "Invalid positions data" });
      }

      const results = [];

      // Process each item type
      for (const [itemType, animals] of Object.entries(positions)) {
        if (typeof animals !== 'object') continue;

        // Process each animal for this item
        for (const [animalType, posData] of Object.entries(animals as any)) {
          if (typeof posData !== 'object') continue;

          const { x, y, scale, rotation } = posData as any;

          // Check if position exists
          const [existing] = await db
            .select()
            .from(itemAnimalPositions)
            .where(
              and(
                eq(itemAnimalPositions.itemTypeId, itemType),
                eq(itemAnimalPositions.animalTypeId, animalType)
              )
            )
            .limit(1);

          if (existing) {
            // Update existing
            const [updated] = await db
              .update(itemAnimalPositions)
              .set({
                xPosition: x?.toString() ?? '50',
                yPosition: y?.toString() ?? '50',
                scale: scale?.toString() ?? '1.0',
                rotation: rotation ?? 0,
                updatedAt: new Date()
              })
              .where(eq(itemAnimalPositions.id, existing.id))
              .returning();
            results.push(updated);
          } else {
            // Create new
            const [created] = await db
              .insert(itemAnimalPositions)
              .values({
                itemTypeId: itemType,
                animalTypeId: animalType,
                xPosition: x?.toString() ?? '50',
                yPosition: y?.toString() ?? '50',
                scale: scale?.toString() ?? '1.0',
                rotation: rotation ?? 0
              })
              .returning();
            results.push(created);
          }
        }
      }

      res.json({ updated: results.length, positions: results });
    } catch (error) {
      console.error("Batch update positions error:", error);
      res.status(500).json({ message: "Failed to batch update positions" });
    }
  });
}
