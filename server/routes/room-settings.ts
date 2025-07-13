// Room settings endpoints
import type { Express } from "express";
import { db } from "../db";
import { students } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { checkRoomAccess } from "../middleware/room-access";
import { optionalStudentAuth } from "../middleware/passport-auth";

// Validation schema
const updateVisibilitySchema = z.object({
  visibility: z.enum(['private', 'class', 'invite_only'])
});

export function registerRoomSettingsRoutes(app: Express) {
  
  // Get room settings
  app.get("/api/room/:passportCode/settings", checkRoomAccess, async (req, res) => {
    try {
      // Must be owner to view settings
      if (!req.roomAccess?.isOwner && !req.roomAccess?.isTeacher) {
        return res.status(403).json({ message: "Only room owner can view settings" });
      }

      const { passportCode } = req.params;
      
      const [student] = await db
        .select({
          roomVisibility: students.roomVisibility
        })
        .from(students)
        .where(eq(students.passportCode, passportCode))
        .limit(1);

      if (!student) {
        return res.status(404).json({ message: "Room not found" });
      }

      res.json({
        visibility: student.roomVisibility || 'class',
        options: [
          {
            value: 'class',
            label: 'My Class',
            description: 'Classmates can visit your room',
            icon: '🏠'
          },
          {
            value: 'private',
            label: 'Just Me',
            description: 'Only you can see your room',
            icon: '🔒'
          }
          // invite_only will be added in Phase 3
        ]
      });
    } catch (error) {
      console.error("Get room settings error:", error);
      res.status(500).json({ message: "Failed to get room settings" });
    }
  });

  // Update room visibility
  app.patch("/api/room/:passportCode/settings/visibility", optionalStudentAuth, checkRoomAccess, async (req, res) => {
    try {
      // Must be owner to change settings
      if (!req.roomAccess?.isOwner && !req.roomAccess?.isTeacher) {
        return res.status(403).json({ message: "Only room owner can change settings" });
      }

      const { passportCode } = req.params;
      const { visibility } = updateVisibilitySchema.parse(req.body);

      // For now, prevent invite_only until Phase 3
      if (visibility === 'invite_only') {
        return res.status(400).json({ 
          message: "Invite-only rooms coming soon!",
          availableOptions: ['private', 'class']
        });
      }

      // Update visibility
      await db
        .update(students)
        .set({
          roomVisibility: visibility,
          updatedAt: new Date()
        })
        .where(eq(students.passportCode, passportCode));

      // Log the change
      console.log(`Room visibility updated: ${passportCode} -> ${visibility}`);

      res.json({
        message: visibility === 'private' 
          ? "Your room is now private! Only you can see it."
          : "Your room is now open to classmates!",
        visibility
      });
    } catch (error) {
      console.error("Update room visibility error:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid visibility setting",
          errors: error.errors
        });
      }
      
      res.status(500).json({ message: "Failed to update room settings" });
    }
  });
}