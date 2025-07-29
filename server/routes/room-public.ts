// Public room viewing routes - read-only access for viewing other students' rooms
import type { Express } from "express";
import { db } from "../db";
import { students, classes, animalTypes, geniusTypes } from "@shared/schema";
import { eq } from "drizzle-orm";
import { isValidPassportCode } from "@shared/currency-types";
import { roomBrowsingLimiter } from "../middleware/rateLimiter";
import { getCache } from "../lib/cache-factory";

const cache = getCache();

export function registerPublicRoomRoutes(app: Express) {
  // Public endpoint for viewing any student's room (READ ONLY)
  app.get("/api/room/view/:passportCode", roomBrowsingLimiter, async (_req, res) => {
    try {
      const { passportCode } = req.params;
      
      // Validate passport code format
      if (!isValidPassportCode(passportCode)) {
        return res.status(400).json({ message: "Invalid passport code format" });
      }

      // Check cache first
      const cacheKey = `room-view:${passportCode}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // Get student's public room data
      const studentData = await db
        .select({
          studentName: students.studentName,
          gradeLevel: students.gradeLevel,
          personalityType: students.personalityType,
          animalType: animalTypes.name,
          animalGenius: geniusTypes.name,
          avatarData: students.avatarData,
          roomData: students.roomData,
          className: classes.name,
          createdAt: students.createdAt
        })
        .from(students)
        .innerJoin(classes, eq(students.classId, classes.id))
        .leftJoin(animalTypes, eq(students.animalTypeId, animalTypes.id))
        .leftJoin(geniusTypes, eq(students.geniusTypeId, geniusTypes.id))
        .where(eq(students.passportCode, passportCode))
        .limit(1);

      if (studentData.length === 0) {
        return res.status(404).json({ message: "Student room not found" });
      }

      const roomData = {
        ...studentData[0],
        isPublicView: true,
        canEdit: false
      };

      // Cache for 5 minutes
      cache.set(cacheKey, roomData, 300);

      res.json(roomData);
    } catch (error) {
      console.error("View room error:", error);
      res.status(500).json({ message: "Failed to load room" });
    }
  });
}