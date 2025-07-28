// Store Management Routes - Teacher controls for store hours
import type { Express, Response } from "express";
import { AuthenticatedRequest } from "../types/api";
import { db } from "../db";
import { storeSettings, classes } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { verifyClassEditAccess } from "../middleware/ownership-collaborator";
import { z } from "zod";
import { getCache } from "../lib/cache-factory";

const cache = getCache();
import { validateUUID } from "../middleware/validateUUID";
import { uuidSchema } from "@shared/validation";

// Store toggle schema
const storeToggleSchema = z.object({
  classId: uuidSchema,
  isOpen: z.boolean()
});

// Auto-approval threshold schema
const autoApprovalSchema = z.object({
  classId: uuidSchema,
  threshold: z.number().min(0).max(1000).nullable() // null means no auto-approval
});

// Store hours schema
const storeHoursSchema = z.object({
  classId: uuidSchema,
  openTime: z.string().optional(), // Format: "HH:MM"
  closeTime: z.string().optional(), // Format: "HH:MM"
  timezone: z.string().optional()
});

export function registerStoreManagementRoutes(app: Express) {
  
  // Toggle store open/closed status
  app.post("/api/currency/store/toggle", requireAuth, verifyClassEditAccess, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
      console.log('[STORE TOGGLE] Request body:', JSON.stringify(authReq.body));
      console.log('[STORE TOGGLE] User:', authReq.user);
      
      const { classId, isOpen } = storeToggleSchema.parse(authReq.body);
      const teacherId = authReq.user?.userId;
      
      if (!teacherId) {
        console.error('[STORE TOGGLE] No teacher ID found');
        return res.status(401).json({ message: "Unauthorized" });
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
            teacherId: teacherId!,
            classId,
            isOpen,
            openedAt: isOpen ? now : null,
            closesAt: null, // No auto-close time yet
          });
      } else {
        // Update existing settings
        await db
          .update(storeSettings)
          .set({
            isOpen,
            openedAt: isOpen ? now : existingSettings[0].openedAt,
            closesAt: isOpen ? null : now, // Record when it was closed
            updatedAt: now
          })
          .where(eq(storeSettings.classId, classId));
      }

      const message = isOpen 
        ? "Store is now open! Students can start making purchases." 
        : "Store is now closed. Students cannot make new purchases.";

      // Invalidate the cache for this class
      const cacheKey = `store-status:${classId}`;
      await cache.del(cacheKey);
      console.log(`🗑️ Cache invalidated for ${cacheKey}`);

      res.json({ 
        success: true, 
        message,
        isOpen,
        timestamp: now
      });
    } catch (error) {
      console.error("Store toggle error:", error);
      if (error instanceof z.ZodError) {
        console.error('[STORE TOGGLE] Validation errors:', error.errors);
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      res.status(500).json({ message: "Failed to toggle store status" });
    }
  });

  // Get current store status for a class
  app.get("/api/classes/:classId/store-status", requireAuth, validateUUID('classId'), verifyClassEditAccess, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const { classId } = authReq.params;
      const teacherId = authReq.user?.userId;
      
      console.log('[STORE STATUS] ClassId:', classId);
      console.log('[STORE STATUS] TeacherId:', teacherId);
      
      if (!teacherId) {
        console.error('[STORE STATUS] No teacher ID found');
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get store settings
      const settings = await db
        .select()
        .from(storeSettings)
        .where(eq(storeSettings.classId, classId))
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
          autoApprovalThreshold: (storeData.settings as any)?.autoApprovalThreshold || 0,
          lastUpdated: storeData.updatedAt,
          updatedBy: storeData.teacherId
        }
      });
    } catch (error) {
      console.error("Get store status error:", error);
      res.status(500).json({ message: "Failed to get store status" });
    }
  });

  // Set auto-approval threshold
  app.post("/api/currency/store/auto-approval", requireAuth, verifyClassEditAccess, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const { classId, threshold } = autoApprovalSchema.parse(authReq.body);
      const teacherId = authReq.user?.userId;

      // Check if store settings exist
      const existingSettings = await db
        .select()
        .from(storeSettings)
        .where(eq(storeSettings.classId, classId))
        .limit(1);

      if (existingSettings.length === 0) {
        // Create new store settings with auto-approval threshold
        await db
          .insert(storeSettings)
          .values({
            teacherId: teacherId!,
            classId,
            isOpen: false,
            settings: { autoApprovalThreshold: threshold },
            createdAt: new Date()
          });
      } else {
        // Update existing settings
        await db
          .update(storeSettings)
          .set({
            settings: { ...(existingSettings[0].settings as any || {}), autoApprovalThreshold: threshold },
            updatedAt: new Date()
          })
          .where(eq(storeSettings.classId, classId));
      }

      const message = threshold === null 
        ? "Auto-approval disabled. All purchases will require manual approval."
        : `Auto-approval enabled for items ${threshold} coins or less.`;

      res.json({ 
        success: true, 
        message,
        threshold
      });
    } catch (error) {
      console.error("Set auto-approval threshold error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to set auto-approval threshold" });
    }
  });

  // Set store hours (future feature)
  app.post("/api/currency/store/hours", requireAuth, verifyClassEditAccess, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const { classId, openTime, closeTime, timezone } = storeHoursSchema.parse(authReq.body);
      const teacherId = authReq.user?.userId;

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