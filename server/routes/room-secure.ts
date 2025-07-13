// Secure Student Room Routes - Using session tokens
// This is the new "room" version of the island-secure routes for Phase 1 migration
import type { Express } from "express";
import { db } from "../db";
import { quizSubmissions, students, classes, purchaseRequests, currencyTransactions, storeSettings, storeItems, animalTypes, geniusTypes } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { isValidPassportCode, TRANSACTION_REASONS } from "@shared/currency-types";
import { z } from "zod";
import { requireUnifiedAuth, requireStudent } from "../middleware/unified-auth";
import { supabaseAdmin } from "../supabase-clients";
// Removed imports for generateSecurePassword and generateStudentEmail - no longer needed
import { authLimiter } from "../middleware/rateLimiter";
import { checkPassportLockout, trackFailedAttempt, clearFailedAttempts } from "../middleware/passport-lockout";
import { sanitizeAvatarData, avatarDataSchema } from "../validation/room-schemas";

// Passport code validation schema
const passportCodeSchema = z.string().regex(/^[A-Z]{3}-[A-Z0-9]{3,4}$/, "Invalid passport code format");

// Password salt no longer needed - students will use Edge Function for JWT generation

export function registerSecureRoomRoutes(app: Express) {
  // ========== CLASS-SCOPED AUTHENTICATION ENDPOINT ==========
  // Exchange passport code for secure session, scoped to a class
  app.post("/api/class/:classCode/authenticate", authLimiter, checkPassportLockout, async (req, res) => {
    try {
      const { classCode } = req.params;
      const { passportCode } = req.body;
      
      // Validate passport code format (allowing 3-4 characters after dash for legacy codes)
      const validationResult = passportCodeSchema.safeParse(passportCode);
      if (!validationResult.success) {
        return res.status(400).json({ error: "Invalid passport code format" });
      }

      // Find the class by code
      const [classData] = await db
        .select()
        .from(classes)
        .where(eq(classes.classCode, classCode.toUpperCase()))
        .limit(1);
        
      if (!classData) {
        return res.status(404).json({ error: "Class not found" });
      }

      // Find student by passport code AND verify they belong to this class
      const studentResult = await db
        .select({
          id: students.id,
          studentName: students.studentName,
          // passportCode removed for security
          classId: students.classId
        })
        .from(students)
        .where(and(
          eq(students.passportCode, passportCode),
          eq(students.classId, classData.id)
        ))
        .limit(1);
      
      const student = studentResult[0];
      
      console.log('Class authentication attempt for:', passportCode, 'in class:', classCode);
      console.log('Found student:', student ? 'yes' : 'no');

      if (!student) {
        // Track failed attempt
        const isLocked = trackFailedAttempt(passportCode);
        if (isLocked) {
          return res.status(429).json({ error: "Too many failed attempts. Please try again later." });
        }
        return res.status(401).json({ error: "Invalid passport code for this class" });
      }

      // Clear failed attempts on successful login
      clearFailedAttempts(passportCode);
      
      console.log('Authenticating student ID:', student.id);
      
      // Return success with student info (no Edge Function needed)
      res.json({
        success: true,
        student: {
          id: student.id,
          name: student.studentName,
          classId: student.classId,
          passportCode: student.passportCode
        },
        studentName: student.studentName,
        message: "Welcome to your class island!"
      });
    } catch (error) {
      console.error("Class authentication error:", error);
      res.status(500).json({ error: "Failed to authenticate" });
    }
  });
  
  // ========== AUTHENTICATION ENDPOINT ==========
  // Exchange passport code for secure session (no class scope)
  app.post("/api/room/authenticate", authLimiter, checkPassportLockout, async (req, res) => {
    try {
      const { passportCode } = req.body;
      
      // Validate passport code format (allowing 3-4 characters after dash for legacy codes)
      const validationResult = passportCodeSchema.safeParse(passportCode);
      if (!validationResult.success) {
        return res.status(400).json({ error: "Invalid passport code format" });
      }

      // Find student by passport code - using students table instead
      const studentResult = await db
        .select({
          id: students.id,
          studentName: students.studentName,
          passportCode: students.passportCode,
          classId: students.classId
        })
        .from(students)
        .where(eq(students.passportCode, passportCode))
        .limit(1);
      
      const student = studentResult[0];
      
      console.log('Authentication attempt for:', passportCode);
      console.log('Found student:', student ? 'yes' : 'no');

      if (!student) {
        // Track failed attempt
        const isLocked = trackFailedAttempt(passportCode);
        if (isLocked) {
          return res.status(429).json({ error: "Too many failed attempts. Please try again later." });
        }
        return res.status(401).json({ error: "Invalid passport code" });
      }

      // Clear failed attempts on successful login
      clearFailedAttempts(passportCode);
      
      console.log('Authenticating student ID:', student.id);
      
      // Return success with student info (no Edge Function needed)
      res.json({
        success: true,
        student: {
          id: student.id,
          name: student.studentName,
          classId: student.classId,
          passportCode: student.passportCode
        },
        studentName: student.studentName,
        message: "Welcome to your class island!"
      });
    } catch (error) {
      console.error("Authentication error:", error);
      res.status(500).json({ error: "Failed to authenticate" });
    }
  });

  // ========== LOGOUT ENDPOINT ==========
  app.post("/api/room/logout", (req, res) => {
    // For token-based auth, logout is handled client-side by removing the token
    // We still clear any legacy cookies for backward compatibility
    res.clearCookie('student_session');
    res.json({ success: true, message: "Logged out successfully" });
  });

  // ========== CHECK SESSION ENDPOINT ==========
  app.get("/api/room/check-session", requireUnifiedAuth, requireStudent, async (req, res) => {
    try {
      const [student] = await db
        .select({
          studentName: students.studentName,
          passportCode: students.passportCode
        })
        .from(students)
        .where(eq(students.id, req.studentId!))
        .limit(1);

      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      res.json({ 
        authenticated: true,
        studentName: student.studentName
      });
    } catch (error) {
      console.error("Session check error:", error);
      res.status(500).json({ error: "Failed to check session" });
    }
  });

  // ========== SECURE ENDPOINTS (require session) ==========
  
  // Get student room data (secure version)
  app.get("/api/room/me", requireUnifiedAuth, requireStudent, async (req, res) => {
    try {
      const studentData = await db
        .select({
          id: students.id,
          studentName: students.studentName,
          gradeLevel: students.gradeLevel,
          personalityType: students.personalityType,
          animalTypeId: students.animalTypeId,
          geniusTypeId: students.geniusTypeId,
          animalType: animalTypes.name,
          animalGenius: geniusTypes.name,
          learningStyle: students.learningStyle,
          currencyBalance: students.currencyBalance,
          avatarData: students.avatarData,
          roomData: students.roomData,
          createdAt: students.createdAt,
          // passportCode removed for security
          // Class info
          className: classes.name,
          classId: classes.id
        })
        .from(students)
        .innerJoin(classes, eq(students.classId, classes.id))
        .leftJoin(animalTypes, eq(students.animalTypeId, animalTypes.id))
        .leftJoin(geniusTypes, eq(students.geniusTypeId, geniusTypes.id))
        .where(eq(students.id, req.studentId!))
        .limit(1);

      if (studentData.length === 0) {
        return res.status(404).json({ error: "Student room not found" });
      }

      const student = studentData[0];

      // Format response for student room
      const roomData = {
        id: student.id,
        studentName: student.studentName,
        gradeLevel: student.gradeLevel,
        animalType: student.animalType || student.animalTypeId,
        personalityType: student.personalityType,
        animalGenius: student.animalGenius,
        learningStyle: student.learningStyle,
        currencyBalance: student.currencyBalance || 0,
        avatarData: student.avatarData || {},
        roomData: student.roomData || { furniture: [] },
        className: student.className,
        classId: student.classId,
        completedAt: student.completedAt
      };

      res.json(roomData);
    } catch (error) {
      console.error("Get room data error:", error);
      res.status(500).json({ error: "Failed to get room data" });
    }
  });

  // Check store status (secure version)
  app.get("/api/room/me/store", requireUnifiedAuth, requireStudent, async (req, res) => {
    try {
      // Get student's class
      const studentClass = await db
        .select({
          classId: classes.id,
          className: classes.name
        })
        .from(students)
        .innerJoin(classes, eq(students.classId, classes.id))
        .where(eq(students.id, req.studentId!))
        .limit(1);

      if (studentClass.length === 0) {
        return res.status(404).json({ error: "Student not found" });
      }

      // Direct purchase system - store is always open
      const storeStatus = {
        isOpen: true,
        message: "Store is always open! Shop anytime with your coins!",
        classId: studentClass[0].classId,
        className: studentClass[0].className,
        isDirect: true
      };

      res.json(storeStatus);
    } catch (error) {
      console.error("Get store status error:", error);
      res.status(500).json({ error: "Failed to get store status" });
    }
  });


  // Equip/unequip items endpoint (secure version)
  app.post("/api/room/me/equip", requireUnifiedAuth, requireStudent, async (req, res) => {
    try {
      const { slot, itemId } = req.body;
      
      // Validate slot
      if (!['hat', 'glasses', 'accessory'].includes(slot)) {
        return res.status(400).json({ error: "Invalid equipment slot" });
      }
      
      // Get student data
      const studentData = await db
        .select({
          id: students.id,
          avatarData: students.avatarData
        })
        .from(students)
        .where(eq(students.id, req.studentId!))
        .limit(1);
      
      if (studentData.length === 0) {
        return res.status(404).json({ error: "Student not found" });
      }
      
      const student = studentData[0];
      const currentAvatarData = student.avatarData as any || {};
      const ownedItems = currentAvatarData.owned || [];
      const equippedItems = currentAvatarData.equipped || {};
      
      // If itemId is provided, verify ownership
      if (itemId && !ownedItems.includes(itemId)) {
        return res.status(400).json({ error: "You don't own this item" });
      }
      
      // Update equipped items
      const newEquipped = { ...equippedItems };
      if (itemId) {
        newEquipped[slot] = itemId;
      } else {
        // Unequip
        delete newEquipped[slot];
      }
      
      // Create new avatar data with updated equipment
      const newAvatarData = {
        ...currentAvatarData,
        equipped: newEquipped
      };
      
      // Validate and sanitize the new avatar data
      const validationResult = avatarDataSchema.safeParse(newAvatarData);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid avatar data",
          details: validationResult.error.errors 
        });
      }
      
      const sanitizedData = sanitizeAvatarData(validationResult.data);
      
      // Update database
      await db
        .update(students)
        .set({
          avatarData: sanitizedData
        })
        .where(eq(students.id, student.id));
      
      res.json({
        message: itemId ? "Item equipped!" : "Item unequipped!",
        equipped: newEquipped
      });
    } catch (error) {
      console.error("Equip item error:", error);
      res.status(500).json({ error: "Failed to equip item" });
    }
  });
}