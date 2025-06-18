import type { Express } from "express";
import { db } from "../db";
import { itemAnimalPositions, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

export function registerItemPositionRoutes(app: Express) {
  // Get all item positions (for matrix view)
  app.get("/api/admin/item-positions", requireAuth, async (req: any, res) => {
    try {
      // Get user details to verify admin access
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.user.userId))
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
  app.post("/api/admin/item-positions", requireAuth, async (req: any, res) => {
    try {
      // Get user details to verify admin access
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.user.userId))
        .limit(1);

      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { item_id, animal_type, position_x, position_y, scale, rotation } = req.body;

      // Validate input
      if (!item_id || !animal_type) {
        return res.status(400).json({ message: "Item ID and animal type are required" });
      }

      // Check if position exists
      const [existing] = await db
        .select()
        .from(itemAnimalPositions)
        .where(
          and(
            eq(itemAnimalPositions.itemId, item_id),
            eq(itemAnimalPositions.animalType, animal_type)
          )
        )
        .limit(1);

      if (existing) {
        // Update existing position
        const [updated] = await db
          .update(itemAnimalPositions)
          .set({
            positionX: position_x ?? 0,
            positionY: position_y ?? 0,
            scale: scale ?? 1,
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
            itemId: item_id,
            animalType: animal_type,
            positionX: position_x ?? 0,
            positionY: position_y ?? 0,
            scale: scale ?? 1,
            rotation: rotation ?? 0
          })
          .returning();

        res.json(created);
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
        .from(users)
        .where(eq(users.id, req.user.userId))
        .limit(1);

      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { item_id, source_animal, target_animals } = req.body;

      if (!item_id || !source_animal || !Array.isArray(target_animals)) {
        return res.status(400).json({ message: "Invalid request data" });
      }

      // Get source position
      const [sourcePosition] = await db
        .select()
        .from(itemAnimalPositions)
        .where(
          and(
            eq(itemAnimalPositions.itemId, item_id),
            eq(itemAnimalPositions.animalType, source_animal)
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
              eq(itemAnimalPositions.itemId, item_id),
              eq(itemAnimalPositions.animalType, targetAnimal)
            )
          )
          .limit(1);

        if (existing) {
          // Update existing
          const [updated] = await db
            .update(itemAnimalPositions)
            .set({
              positionX: sourcePosition.positionX,
              positionY: sourcePosition.positionY,
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
              itemId: item_id,
              animalType: targetAnimal,
              positionX: sourcePosition.positionX,
              positionY: sourcePosition.positionY,
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
}
