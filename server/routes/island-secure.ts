// Secure Student Island Routes - Using session tokens
import type { Express } from "express";
import { db } from "../db";
import { quizSubmissions, classes, purchaseRequests, currencyTransactions, storeSettings, storeItems } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { isValidPassportCode, validatePurchaseRequest, TRANSACTION_REASONS } from "@shared/currency-types";
import { z } from "zod";
import { requireStudentSession, generateStudentSession } from "../middleware/student-auth";
import { authLimiter } from "../middleware/rateLimiter";

// Passport code validation schema
const passportCodeSchema = z.string().regex(/^[A-Z]{3}-[A-Z0-9]{3,4}$/, "Invalid passport code format");

export function registerSecureIslandRoutes(app: Express) {
  // ========== AUTHENTICATION ENDPOINT ==========
  // Exchange passport code for secure session
  app.post("/api/island/authenticate", authLimiter, async (req, res) => {
    try {
      const { passportCode } = req.body;
      
      // Validate passport code format (allowing 3-4 characters after dash for legacy codes)
      const validationResult = passportCodeSchema.safeParse(passportCode);
      if (!validationResult.success) {
        return res.status(400).json({ error: "Invalid passport code format" });
      }

      // Find student by passport code
      const [student] = await db
        .select({
          id: quizSubmissions.id,
          studentName: quizSubmissions.studentName,
          passportCode: quizSubmissions.passportCode
        })
        .from(quizSubmissions)
        .where(eq(quizSubmissions.passportCode, passportCode))
        .limit(1);

      if (!student) {
        return res.status(401).json({ error: "Invalid passport code" });
      }

      // Generate session token
      const sessionToken = generateStudentSession(student.id);

      // Set httpOnly cookie
      res.cookie('student_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/'
      });

      res.json({ 
        success: true,
        studentName: student.studentName,
        message: "Welcome to your island!"
      });
    } catch (error) {
      console.error("Authentication error:", error);
      res.status(500).json({ error: "Failed to authenticate" });
    }
  });

  // ========== LOGOUT ENDPOINT ==========
  app.post("/api/island/logout", (req, res) => {
    res.clearCookie('student_session');
    res.json({ success: true, message: "Logged out successfully" });
  });

  // ========== CHECK SESSION ENDPOINT ==========
  app.get("/api/island/check-session", requireStudentSession, async (req, res) => {
    try {
      const [student] = await db
        .select({
          studentName: quizSubmissions.studentName,
          passportCode: quizSubmissions.passportCode
        })
        .from(quizSubmissions)
        .where(eq(quizSubmissions.id, req.studentSubmissionId!))
        .limit(1);

      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      res.json({ 
        authenticated: true,
        studentName: student.studentName,
        passportCode: student.passportCode
      });
    } catch (error) {
      console.error("Session check error:", error);
      res.status(500).json({ error: "Failed to check session" });
    }
  });

  // ========== SECURE ENDPOINTS (require session) ==========
  
  // Get student island data (secure version)
  app.get("/api/island/me", requireStudentSession, async (req, res) => {
    try {
      const studentData = await db
        .select({
          id: quizSubmissions.id,
          studentName: quizSubmissions.studentName,
          gradeLevel: quizSubmissions.gradeLevel,
          personalityType: quizSubmissions.personalityType,
          animalType: quizSubmissions.animalType,
          animalGenius: quizSubmissions.animalGenius,
          learningStyle: quizSubmissions.learningStyle,
          currencyBalance: quizSubmissions.currencyBalance,
          avatarData: quizSubmissions.avatarData,
          roomData: quizSubmissions.roomData,
          completedAt: quizSubmissions.completedAt,
          passportCode: quizSubmissions.passportCode,
          // Class info
          className: classes.name,
          classId: classes.id
        })
        .from(quizSubmissions)
        .innerJoin(classes, eq(quizSubmissions.classId, classes.id))
        .where(eq(quizSubmissions.id, req.studentSubmissionId!))
        .limit(1);

      if (studentData.length === 0) {
        return res.status(404).json({ error: "Student island not found" });
      }

      const student = studentData[0];

      // Format response for student island
      const islandData = {
        id: student.id,
        passportCode: student.passportCode,
        studentName: student.studentName,
        gradeLevel: student.gradeLevel,
        animalType: student.animalType,
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

      res.json(islandData);
    } catch (error) {
      console.error("Get island data error:", error);
      res.status(500).json({ error: "Failed to get island data" });
    }
  });

  // Check store status (secure version)
  app.get("/api/island/me/store", requireStudentSession, async (req, res) => {
    try {
      // Get student's class
      const studentClass = await db
        .select({
          classId: classes.id,
          className: classes.name
        })
        .from(quizSubmissions)
        .innerJoin(classes, eq(quizSubmissions.classId, classes.id))
        .where(eq(quizSubmissions.id, req.studentSubmissionId!))
        .limit(1);

      if (studentClass.length === 0) {
        return res.status(404).json({ error: "Student not found" });
      }

      // Check store settings for the class
      const storeSettingsData = await db
        .select()
        .from(storeSettings)
        .where(eq(storeSettings.classId, studentClass[0].classId))
        .limit(1);

      let storeStatus;
      if (storeSettingsData.length === 0) {
        // No store settings yet - store is closed by default
        storeStatus = {
          isOpen: false,
          message: "Store is currently closed. Your teacher will announce when it opens!",
          classId: studentClass[0].classId,
          className: studentClass[0].className
        };
      } else {
        const settings = storeSettingsData[0];
        const now = new Date();
        
        // Check if store is within open hours
        let isOpen = settings.isOpen;
        let message = "Store is open! Happy shopping!";
        
        if (!settings.isOpen) {
          message = "Store is currently closed by your teacher.";
        } else if (settings.closesAt && new Date(settings.closesAt) < now) {
          isOpen = false;
          message = "Store hours have ended for today.";
        } else if (settings.openedAt && new Date(settings.openedAt) > now) {
          isOpen = false;
          message = "Store will open soon!";
        }
        
        storeStatus = {
          isOpen,
          message,
          classId: studentClass[0].classId,
          className: studentClass[0].className,
          openedAt: settings.openedAt,
          closesAt: settings.closesAt
        };
      }

      res.json(storeStatus);
    } catch (error) {
      console.error("Get store status error:", error);
      res.status(500).json({ error: "Failed to get store status" });
    }
  });

  // Create purchase request (secure version)
  app.post("/api/island/me/purchase", requireStudentSession, async (req, res) => {
    try {
      const { itemId } = req.body;
      
      // Get student data
      const studentData = await db
        .select({
          id: quizSubmissions.id,
          currencyBalance: quizSubmissions.currencyBalance,
          classId: quizSubmissions.classId
        })
        .from(quizSubmissions)
        .where(eq(quizSubmissions.id, req.studentSubmissionId!))
        .limit(1);

      if (studentData.length === 0) {
        return res.status(404).json({ error: "Student not found" });
      }

      const student = studentData[0];
      
      // Validate purchase request
      const validation = validatePurchaseRequest(itemId, student.currencyBalance || 0);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Get item details from database
      const itemData = await db
        .select()
        .from(storeItems)
        .where(and(
          eq(storeItems.id, itemId),
          eq(storeItems.isActive, true)
        ))
        .limit(1);
      
      if (itemData.length === 0) {
        return res.status(400).json({ error: "Item not found in store" });
      }
      
      const item = itemData[0];

      // Check if store is open for the class
      const storeStatus = await db
        .select()
        .from(storeSettings)
        .where(eq(storeSettings.classId, student.classId))
        .limit(1);

      if (storeStatus.length === 0 || !storeStatus[0].isOpen) {
        return res.status(400).json({ error: "Store is currently closed" });
      }

      // Check for existing pending request for same item
      const existingRequest = await db
        .select()
        .from(purchaseRequests)
        .where(
          and(
            eq(purchaseRequests.studentId, student.id),
            eq(purchaseRequests.itemId, itemId),
            eq(purchaseRequests.status, 'pending')
          )
        )
        .limit(1);

      if (existingRequest.length > 0) {
        return res.status(400).json({ error: "You already have a pending request for this item" });
      }
      
      // Calculate total pending requests cost
      const pendingRequests = await db
        .select({
          cost: purchaseRequests.cost
        })
        .from(purchaseRequests)
        .where(
          and(
            eq(purchaseRequests.studentId, student.id),
            eq(purchaseRequests.status, 'pending')
          )
        );
      
      const totalPendingCost = pendingRequests.reduce((sum, req) => sum + req.cost, 0);
      const availableBalance = (student.currencyBalance || 0) - totalPendingCost;
      
      // Check if student has enough available balance (current balance - pending requests)
      if (availableBalance < item.cost) {
        return res.status(400).json({ 
          error: `Not enough available coins. You have ${availableBalance} coins available (${student.currencyBalance} total - ${totalPendingCost} pending).` 
        });
      }

      // Create purchase request
      const [purchaseRequest] = await db
        .insert(purchaseRequests)
        .values({
          studentId: student.id,
          itemType: item.itemType,
          itemId: item.id,
          cost: item.cost,
          status: 'pending'
        })
        .returning();

      res.json({
        message: "Purchase request submitted! Waiting for teacher approval.",
        request: purchaseRequest
      });
    } catch (error) {
      console.error("Purchase request error:", error);
      res.status(500).json({ error: "Failed to create purchase request" });
    }
  });

  // Get student's purchase requests (secure version)
  app.get("/api/island/me/purchases", requireStudentSession, async (req, res) => {
    try {
      // Get purchase requests
      const requests = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.studentId, req.studentSubmissionId!))
        .orderBy(desc(purchaseRequests.requestedAt));

      res.json(requests);
    } catch (error) {
      console.error("Get purchase requests error:", error);
      res.status(500).json({ error: "Failed to get purchase requests" });
    }
  });

  // Equip/unequip items endpoint (secure version)
  app.post("/api/island/me/equip", requireStudentSession, async (req, res) => {
    try {
      const { slot, itemId } = req.body;
      
      // Validate slot
      if (!['hat', 'glasses', 'accessory'].includes(slot)) {
        return res.status(400).json({ error: "Invalid equipment slot" });
      }
      
      // Get student data
      const studentData = await db
        .select({
          id: quizSubmissions.id,
          avatarData: quizSubmissions.avatarData
        })
        .from(quizSubmissions)
        .where(eq(quizSubmissions.id, req.studentSubmissionId!))
        .limit(1);
      
      if (studentData.length === 0) {
        return res.status(404).json({ error: "Student not found" });
      }
      
      const student = studentData[0];
      const currentAvatarData = student.avatarData || {};
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
      
      // Update database
      await db
        .update(quizSubmissions)
        .set({
          avatarData: {
            ...currentAvatarData,
            equipped: newEquipped
          }
        })
        .where(eq(quizSubmissions.id, student.id));
      
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
