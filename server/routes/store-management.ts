// Store Management Routes - Teacher controls for store hours
import type { Express, Request, Response } from "express";
import { db } from "../db";
import { storeSettings, classes } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

// Store toggle schema
const storeToggleSchema = z.object({
  classId: z.number().positive(),
  isOpen: z.boolean()
});

// Store hours schema
const storeHoursSchema = z.object({
  classId: z.number().positive(),
  openTime: z.string().optional(), // Format: "HH:MM"
  closeTime: z.string().optional(), // Format: "HH:MM"
  timezone: z.string().optional()
});

export function registerStoreManagementRoutes(app: Express) {
  
  // Toggle store open/closed status
  app.post("/api/currency/store/toggle", requireAuth, async (req: any, res) => {
    try {
      const { classId, isOpen } = storeToggleSchema.parse(req.body);
      const teacherId = req.user?.userId || req.user?.id;
      
      // Verify teacher owns this class
      const classData = await db
        .select()
        .from(classes)
        .where(
          and(
            eq(classes.id, classId),
            eq(classes.teacherId, teacherId!)
          )
        )
        .limit(1);

      if (classData.length === 0) {
        return res.status(403).json({ message: "Access denied - you don't own this class" });
      }

      // Check if store settings exist
      const existingSettings = await db
        .select()
        .from(storeSettings)
        .where(eq(storeSettings.classId, classId))
        .limit(1);

      const now = new Date();
      
      if (existingSettings.length === 0) {
        // Create new store settings
        await db
          .insert(storeSettings)
          .values({
            classId,
            isOpen,
            openedAt: isOpen ? now : null,
            closesAt: null, // No auto-close time yet
            updatedBy: teacherId!
          });
      } else {
        // Update existing settings
        await db
          .update(storeSettings)
          .set({
            isOpen,
            openedAt: isOpen ? now : existingSettings[0].openedAt,
            closesAt: isOpen ? null : now, // Record when it was closed
            updatedBy: teacherId!,
            updatedAt: now
          })
          .where(eq(storeSettings.classId, classId));
      }

      const message = isOpen 
        ? "Store is now open! Students can start making purchase requests." 
        : "Store is now closed. Students cannot make new purchase requests.";

      res.json({ 
        success: true, 
        message,
        isOpen,
        timestamp: now
      });
    } catch (error) {
      console.error("Store toggle error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to toggle store status" });
    }
  });

  // Get current store status for a class
  app.get("/api/classes/:classId/store-status", requireAuth, async (req: any, res) => {
    try {
      const { classId } = req.params;
      const teacherId = req.user?.userId || req.user?.id;
      
      // Verify teacher owns this class
      const classData = await db
        .select()
        .from(classes)
        .where(
          and(
            eq(classes.id, parseInt(classId)),
            eq(classes.teacherId, teacherId!)
          )
        )
        .limit(1);

      if (classData.length === 0) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get store settings
      const settings = await db
        .select()
        .from(storeSettings)
        .where(eq(storeSettings.classId, parseInt(classId)))
        .limit(1);

      if (settings.length === 0) {
        // No settings yet - store is closed by default
        return res.json({
          isOpen: false,
          message: "Store has never been opened",
          settings: null
        });
      }

      const storeData = settings[0];
      const now = new Date();
      
      // Check if store should be auto-closed based on time
      let effectivelyOpen = storeData.isOpen;
      let message = effectivelyOpen ? "Store is open" : "Store is closed";
      
      if (storeData.isOpen && storeData.closesAt && new Date(storeData.closesAt) < now) {
        effectivelyOpen = false;
        message = "Store hours have ended";
      }

      res.json({
        isOpen: effectivelyOpen,
        message,
        settings: {
          openedAt: storeData.openedAt,
          closesAt: storeData.closesAt,
          lastUpdated: storeData.updatedAt,
          updatedBy: storeData.updatedBy
        }
      });
    } catch (error) {
      console.error("Get store status error:", error);
      res.status(500).json({ message: "Failed to get store status" });
    }
  });

  // Set store hours (future feature)
  app.post("/api/currency/store/hours", requireAuth, async (req: any, res) => {
    try {
      const { classId, openTime, closeTime, timezone } = storeHoursSchema.parse(req.body);
      const teacherId = req.user?.userId || req.user?.id;
      
      // Verify teacher owns this class
      const classData = await db
        .select()
        .from(classes)
        .where(
          and(
            eq(classes.id, classId),
            eq(classes.teacherId, teacherId!)
          )
        )
        .limit(1);

      if (classData.length === 0) {
        return res.status(403).json({ message: "Access denied" });
      }

      // This is a placeholder for future store hours functionality
      res.json({
        message: "Store hours feature coming soon!",
        requestedHours: {
          openTime,
          closeTime,
          timezone: timezone || "America/Phoenix"
        }
      });
    } catch (error) {
      console.error("Set store hours error:", error);
      res.status(500).json({ message: "Failed to set store hours" });
    }
  });
}
