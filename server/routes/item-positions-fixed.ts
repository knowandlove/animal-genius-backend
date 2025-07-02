import type { Express } from "express";
import { db } from "../db";
import { itemAnimalPositions, profiles, itemTypes, animalTypes } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

export function registerItemPositionRoutes(app: Express) {
  // Public endpoint to get item positions with human-readable codes
  app.get("/api/item-positions", async (req, res) => {
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

  // Get all item positions (for matrix view) - returns UUIDs
  app.get("/api/admin/item-positions", requireAuth, async (req: any, res) => {
    try {
      // Get user details to verify admin access
      const [user] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, req.user.userId))
        .limit(1);

      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const positions = await db
        .select({
          id: itemAnimalPositions.id,
          itemTypeId: itemAnimalPositions.itemTypeId,
          animalTypeId: itemAnimalPositions.animalTypeId,
          itemType: itemTypes.code,
          animalType: animalTypes.code,
          xPosition: itemAnimalPositions.xPosition,
          yPosition: itemAnimalPositions.yPosition,
          scale: itemAnimalPositions.scale,
          rotation: itemAnimalPositions.rotation,
          createdAt: itemAnimalPositions.createdAt,
          updatedAt: itemAnimalPositions.updatedAt
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

  // Save/update item position using item and animal codes
  app.post("/api/admin/item-positions", requireAuth, async (req: any, res) => {
    try {
      // Get user details to verify admin access
      const [user] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, req.user.userId))
        .limit(1);

      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { item_type, animal_type, x_position, y_position, scale, rotation } = req.body;

      // Validate input
      if (!item_type || !animal_type) {
        return res.status(400).json({ message: "Item type and animal type are required" });
      }

      // Look up item type and animal type IDs
      const [itemType] = await db
        .select()
        .from(itemTypes)
        .where(eq(itemTypes.code, item_type))
        .limit(1);

      const [animalType] = await db
        .select()
        .from(animalTypes)
        .where(eq(animalTypes.code, animal_type))
        .limit(1);

      if (!itemType || !animalType) {
        return res.status(400).json({ message: "Invalid item type or animal type" });
      }

      // Check if position exists
      const [existing] = await db
        .select()
        .from(itemAnimalPositions)
        .where(
          and(
            eq(itemAnimalPositions.itemTypeId, itemType.id),
            eq(itemAnimalPositions.animalTypeId, animalType.id)
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
            scale: scale?.toString() ?? '1.0',
            rotation: rotation ?? 0,
            updatedAt: new Date()
          })
          .where(eq(itemAnimalPositions.id, existing.id))
          .returning();

        res.json({
          ...updated,
          itemType: item_type,
          animalType: animal_type
        });
      } else {
        // Create new position
        const [created] = await db
          .insert(itemAnimalPositions)
          .values({
            itemTypeId: itemType.id,
            animalTypeId: animalType.id,
            xPosition: x_position?.toString() ?? '50',
            yPosition: y_position?.toString() ?? '50',
            scale: scale?.toString() ?? '1.0',
            rotation: rotation ?? 0
          })
          .returning();

        res.json({
          ...created,
          itemType: item_type,
          animalType: animal_type
        });
      }
    } catch (error) {
      console.error("Save item position error:", error);
      res.status(500).json({ message: "Failed to save item position" });
    }
  });

  // Bulk copy positions from one animal to others
  app.post("/api/admin/item-positions/bulk-copy", requireAuth, async (req: any, res) => {
    try {
      // Get user details to verify admin access
      const [user] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, req.user.userId))
        .limit(1);

      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { item_type, source_animal, target_animals } = req.body;

      if (!item_type || !source_animal || !Array.isArray(target_animals)) {
        return res.status(400).json({ message: "Invalid request data" });
      }

      // Look up item type ID
      const [itemType] = await db
        .select()
        .from(itemTypes)
        .where(eq(itemTypes.code, item_type))
        .limit(1);

      // Look up source animal type ID
      const [sourceAnimalType] = await db
        .select()
        .from(animalTypes)
        .where(eq(animalTypes.code, source_animal))
        .limit(1);

      if (!itemType || !sourceAnimalType) {
        return res.status(400).json({ message: "Invalid item type or source animal" });
      }

      // Get source position
      const [sourcePosition] = await db
        .select()
        .from(itemAnimalPositions)
        .where(
          and(
            eq(itemAnimalPositions.itemTypeId, itemType.id),
            eq(itemAnimalPositions.animalTypeId, sourceAnimalType.id)
          )
        )
        .limit(1);

      if (!sourcePosition) {
        return res.status(404).json({ message: "Source position not found" });
      }

      // Copy to target animals
      const results = [];
      for (const targetAnimalCode of target_animals) {
        // Look up target animal type ID
        const [targetAnimalType] = await db
          .select()
          .from(animalTypes)
          .where(eq(animalTypes.code, targetAnimalCode))
          .limit(1);

        if (!targetAnimalType) continue;

        // Check if position exists for target
        const [existing] = await db
          .select()
          .from(itemAnimalPositions)
          .where(
            and(
              eq(itemAnimalPositions.itemTypeId, itemType.id),
              eq(itemAnimalPositions.animalTypeId, targetAnimalType.id)
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
          results.push({
            ...updated,
            itemType: item_type,
            animalType: targetAnimalCode
          });
        } else {
          // Create new
          const [created] = await db
            .insert(itemAnimalPositions)
            .values({
              itemTypeId: itemType.id,
              animalTypeId: targetAnimalType.id,
              xPosition: sourcePosition.xPosition,
              yPosition: sourcePosition.yPosition,
              scale: sourcePosition.scale,
              rotation: sourcePosition.rotation
            })
            .returning();
          results.push({
            ...created,
            itemType: item_type,
            animalType: targetAnimalCode
          });
        }
      }

      res.json({ copied: results.length, positions: results });
    } catch (error) {
      console.error("Bulk copy positions error:", error);
      res.status(500).json({ message: "Failed to copy positions" });
    }
  });

  // Batch update positions
  app.post("/api/admin/item-positions/batch", requireAuth, async (req: any, res) => {
    try {
      // Get user details to verify admin access
      const [user] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, req.user.userId))
        .limit(1);

      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { positions } = req.body;

      if (!positions || typeof positions !== 'object') {
        return res.status(400).json({ message: "Invalid positions data" });
      }

      const results = [];

      // Process each item type
      for (const [itemTypeCode, animals] of Object.entries(positions)) {
        if (typeof animals !== 'object') continue;

        // Look up item type ID
        const [itemType] = await db
          .select()
          .from(itemTypes)
          .where(eq(itemTypes.code, itemTypeCode))
          .limit(1);

        if (!itemType) continue;

        // Process each animal for this item
        for (const [animalTypeCode, posData] of Object.entries(animals as any)) {
          if (typeof posData !== 'object') continue;

          const { x, y, scale, rotation } = posData as any;

          // Look up animal type ID
          const [animalType] = await db
            .select()
            .from(animalTypes)
            .where(eq(animalTypes.code, animalTypeCode))
            .limit(1);

          if (!animalType) continue;

          // Check if position exists
          const [existing] = await db
            .select()
            .from(itemAnimalPositions)
            .where(
              and(
                eq(itemAnimalPositions.itemTypeId, itemType.id),
                eq(itemAnimalPositions.animalTypeId, animalType.id)
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
            results.push({
              ...updated,
              itemType: itemTypeCode,
              animalType: animalTypeCode
            });
          } else {
            // Create new
            const [created] = await db
              .insert(itemAnimalPositions)
              .values({
                itemTypeId: itemType.id,
                animalTypeId: animalType.id,
                xPosition: x?.toString() ?? '50',
                yPosition: y?.toString() ?? '50',
                scale: scale?.toString() ?? '1.0',
                rotation: rotation ?? 0
              })
              .returning();
            results.push({
              ...created,
              itemType: itemTypeCode,
              animalType: animalTypeCode
            });
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
