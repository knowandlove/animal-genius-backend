import type { Express, Request, Response } from "express";
import { AuthenticatedRequest } from "../types/api";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { profiles } from "@shared/schema";
import { eq } from "drizzle-orm";

export function registerNormalizedItemPositionRoutes(app: Express) {
  // Public endpoint to get normalized item positions
  app.get("/api/item-positions-normalized", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT 
          item_id,
          animal_type,
          position_x,
          position_y,
          scale,
          rotation,
          anchor_x,
          anchor_y
        FROM item_positions_normalized
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Get normalized positions error:", error);
      res.status(500).json({ message: "Failed to get item positions" });
    }
  });

  // Admin endpoint to get all positions with metadata
  app.get("/api/admin/item-positions-normalized", requireAuth, requireAdmin, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {

      const result = await db.execute(sql`
        SELECT 
          ipn.*,
          im.item_type,
          im.natural_width as item_width,
          im.natural_height as item_height,
          a.natural_width as animal_width,
          a.natural_height as animal_height
        FROM item_positions_normalized ipn
        LEFT JOIN item_metadata im ON ipn.item_id = im.item_id
        LEFT JOIN animals a ON ipn.animal_type = a.animal_type
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Get admin positions error:", error);
      res.status(500).json({ message: "Failed to get positions" });
    }
  });

  // Save/update normalized position
  app.post("/api/admin/item-positions-normalized", requireAuth, requireAdmin, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {

      const { 
        item_id, 
        animal_type, 
        position_x, 
        position_y, 
        scale, 
        rotation,
        anchor_x = 0.5,
        anchor_y = 0.5 
      } = authReq.body;

      console.log('Saving normalized position:', req.body);

      // Validate normalized values
      if (position_x < 0 || position_x > 1 || position_y < 0 || position_y > 1) {
        return res.status(400).json({ error: 'Position values must be between 0 and 1' });
      }
      
      if (scale < 0 || scale > 2) {
        return res.status(400).json({ error: 'Scale must be between 0 and 2' });
      }
      
      if (rotation < -180 || rotation > 180) {
        return res.status(400).json({ error: 'Rotation must be between -180 and 180 degrees' });
      }
      
      if (anchor_x < 0 || anchor_x > 1 || anchor_y < 0 || anchor_y > 1) {
        return res.status(400).json({ error: 'Anchor values must be between 0 and 1' });
      }

      const result = await db.execute(sql`
        INSERT INTO item_positions_normalized 
          (item_id, animal_type, position_x, position_y, scale, rotation, anchor_x, anchor_y)
        VALUES 
          (${item_id}, ${animal_type}, ${position_x}, ${position_y}, ${scale}, ${rotation}, ${anchor_x}, ${anchor_y})
        ON CONFLICT (item_id, animal_type) 
        DO UPDATE SET
          position_x = EXCLUDED.position_x,
          position_y = EXCLUDED.position_y,
          scale = EXCLUDED.scale,
          rotation = EXCLUDED.rotation,
          anchor_x = EXCLUDED.anchor_x,
          anchor_y = EXCLUDED.anchor_y,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `);

      res.json({ success: true, position: result.rows[0] });
    } catch (error) {
      console.error("Save normalized position error:", error);
      console.error("Full error details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        requestBody: req.body
      });
      res.status(500).json({ 
        message: "Failed to save position",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Copy positions to all animals
  app.post("/api/admin/item-positions-normalized/copy-all", requireAuth, requireAdmin, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {

      const { 
        item_id, 
        source_animal, 
        position_x, 
        position_y, 
        scale, 
        rotation,
        anchor_x = 0.5,
        anchor_y = 0.5 
      } = authReq.body;

      // Wrap in transaction for data consistency
      const results = await db.transaction(async (tx) => {
        // Get all animal types
        const animalsResult = await tx.execute(sql`
          SELECT animal_type FROM animals WHERE animal_type != ${source_animal}
        `);
        
        const copiedPositions = [];
        
        // Copy to each animal
        for (const animal of animalsResult.rows) {
          const result = await tx.execute(sql`
            INSERT INTO item_positions_normalized 
              (item_id, animal_type, position_x, position_y, scale, rotation, anchor_x, anchor_y)
            VALUES 
              (${item_id}, ${animal.animal_type}, ${position_x}, ${position_y}, ${scale}, ${rotation}, ${anchor_x}, ${anchor_y})
            ON CONFLICT (item_id, animal_type) 
            DO UPDATE SET
              position_x = EXCLUDED.position_x,
              position_y = EXCLUDED.position_y,
              scale = EXCLUDED.scale,
              rotation = EXCLUDED.rotation,
              anchor_x = EXCLUDED.anchor_x,
              anchor_y = EXCLUDED.anchor_y,
              updated_at = CURRENT_TIMESTAMP
            RETURNING *
          `);
          
          copiedPositions.push(result.rows[0]);
        }
        
        return copiedPositions;
      });

      res.json({ success: true, copied: results.length });
    } catch (error) {
      console.error("Copy positions error:", error);
      res.status(500).json({ message: "Failed to copy positions" });
    }
  });

  // Batch update positions
  app.post("/api/admin/item-positions-normalized/batch", requireAuth, requireAdmin, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const { positions } = req.body;

      if (!Array.isArray(positions) || positions.length === 0) {
        return res.status(400).json({ message: "Invalid batch data" });
      }

      console.log(`Processing batch update for ${positions.length} positions`);

      // Validate all positions before processing
      for (const pos of positions) {
        if (pos.position_x < 0 || pos.position_x > 1 || pos.position_y < 0 || pos.position_y > 1) {
          return res.status(400).json({ error: 'Position values must be between 0 and 1' });
        }
        if (pos.scale < 0 || pos.scale > 2) {
          return res.status(400).json({ error: 'Scale must be between 0 and 2' });
        }
        if (pos.rotation < -180 || pos.rotation > 180) {
          return res.status(400).json({ error: 'Rotation must be between -180 and 180 degrees' });
        }
        if (pos.anchor_x < 0 || pos.anchor_x > 1 || pos.anchor_y < 0 || pos.anchor_y > 1) {
          return res.status(400).json({ error: 'Anchor values must be between 0 and 1' });
        }
      }

      // Process all positions in a single transaction
      await db.transaction(async (tx) => {
        for (const pos of positions) {
          await tx.execute(sql`
            INSERT INTO item_positions_normalized 
              (item_id, animal_type, position_x, position_y, scale, rotation, anchor_x, anchor_y)
            VALUES 
              (${pos.item_id}, ${pos.animal_type}, ${pos.position_x}, ${pos.position_y}, ${pos.scale}, ${pos.rotation}, ${pos.anchor_x}, ${pos.anchor_y})
            ON CONFLICT (item_id, animal_type) 
            DO UPDATE SET
              position_x = EXCLUDED.position_x,
              position_y = EXCLUDED.position_y,
              scale = EXCLUDED.scale,
              rotation = EXCLUDED.rotation,
              anchor_x = EXCLUDED.anchor_x,
              anchor_y = EXCLUDED.anchor_y,
              updated_at = CURRENT_TIMESTAMP
          `);
        }
      });

      res.json({ success: true, count: positions.length });
    } catch (error) {
      console.error("Batch update error:", error);
      res.status(500).json({ message: "Batch update failed" });
    }
  });

  // Get animal metadata
  app.get("/api/animals", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT * FROM animals ORDER BY display_name
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Get animals error:", error);
      res.status(500).json({ message: "Failed to get animals" });
    }
  });
}