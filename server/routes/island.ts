// Student Island Routes - No authentication required
import type { Express } from "express";
import { db } from "../db";
import { quizSubmissions, classes, purchaseRequests, currencyTransactions, storeSettings } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { isValidPassportCode, TRANSACTION_REASONS } from "@shared/currency-types";
import { z } from "zod";
import * as cache from "../lib/cache";

// Passport code validation schema
const passportCodeSchema = z.string().regex(/^[A-Z]{3}-[A-Z0-9]{3}$/, "Invalid passport code format");

export function registerIslandRoutes(app: Express) {
  
  // NEW: Consolidated endpoint for student island page
  app.get("/api/island-page-data/:passportCode", async (req, res) => {
    try {
      const { passportCode } = req.params;
      
      // Validate passport code format
      if (!isValidPassportCode(passportCode)) {
        return res.status(400).json({ message: "Invalid passport code format" });
      }

      // 1. Get student island data with class info
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
          className: classes.name,
          classId: classes.id
        })
        .from(quizSubmissions)
        .innerJoin(classes, eq(quizSubmissions.classId, classes.id))
        .where(eq(quizSubmissions.passportCode, passportCode))
        .limit(1);

      if (studentData.length === 0) {
        return res.status(404).json({ message: "Student island not found" });
      }

      const student = studentData[0];

      // 2. Get store status for the class
      const cacheKey = `store-status:${student.classId}`;
      let storeStatus = cache.get<any>(cacheKey);
      
      if (!storeStatus) {
        console.log(`⚡ Cache miss for ${cacheKey}, fetching from DB`);
        
        const storeSettingsData = await db
          .select()
          .from(storeSettings)
          .where(eq(storeSettings.classId, student.classId))
          .limit(1);

        if (storeSettingsData.length === 0) {
          storeStatus = {
            isOpen: false,
            message: "Store is currently closed. Your teacher will announce when it opens!",
            classId: student.classId,
            className: student.className
          };
        } else {
          const settings = storeSettingsData[0];
          const now = new Date();
          
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
            classId: student.classId,
            className: student.className,
            openedAt: settings.openedAt,
            closesAt: settings.closesAt
          };
        }
        
        // Cache the result
        cache.set(cacheKey, storeStatus);
        console.log(`💾 Cached store status for ${cacheKey}`);
      } else {
        console.log(`✅ Cache hit for ${cacheKey}`);
      }

      // 3. Get store catalog from database
      const { storeItems } = await import("@shared/schema");
      const { asc } = await import("drizzle-orm");
      
      const items = await db
        .select()
        .from(storeItems)
        .where(eq(storeItems.isActive, true))
        .orderBy(asc(storeItems.sortOrder), asc(storeItems.name));
      
      // Import StorageRouter to prepare items with image URLs
      const { default: StorageRouter } = await import("../services/storage-router");
      const preparedItems = await StorageRouter.prepareStoreItemsResponse(items);
      
      const storeCatalog = preparedItems.map(item => ({
        id: item.id,
        name: item.name,
        type: item.itemType,
        cost: item.cost,
        description: item.description,
        rarity: item.rarity,
        imageUrl: item.imageUrl // Now includes the imageUrl!
      }));

      // 4. Get purchase requests and calculate wallet
      const studentPurchaseRequests = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.studentId, student.id))
        .orderBy(desc(purchaseRequests.requestedAt));
      
      // Calculate pending total for wallet display
      const pendingTotal = studentPurchaseRequests
        .filter(req => req.status === 'pending')
        .reduce((sum, req) => sum + req.cost, 0);
      
      const wallet = {
        total: student.currencyBalance || 0,
        pending: pendingTotal,
        available: (student.currencyBalance || 0) - pendingTotal
      };

      // 5. Get inventory items from avatarData.owned and store catalog
      const ownedItemIds = student.avatarData?.owned || [];
      const inventoryItems = ownedItemIds.map(itemId => {
        const catalogItem = storeCatalog.find(item => item.id === itemId);
        if (catalogItem) {
          return {
            ...catalogItem,
            quantity: 1,
            obtainedAt: new Date()
          };
        }
        // If item not in catalog (maybe it was removed), still include it
        return {
          id: itemId,
          name: itemId,
          type: 'avatar_accessory' as const,
          cost: 0,
          description: 'Legacy item',
          rarity: 'common' as const,
          quantity: 1,
          obtainedAt: new Date()
        };
      });

      // Debug log
      console.log(`[DEBUG] Student ${student.studentName} avatarData:`, JSON.stringify(student.avatarData, null, 2));
      console.log(`[DEBUG] Student ${student.studentName} inventoryItems:`, inventoryItems);
      
      // Format consolidated response
      const pageData = {
        island: {
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
          completedAt: student.completedAt,
          inventoryItems // Add this field that the frontend expects
        },
        wallet,
        storeStatus,
        storeCatalog,
        purchaseRequests: studentPurchaseRequests
      };

      res.json(pageData);
    } catch (error) {
      console.error("Get island page data error:", error);
      res.status(500).json({ message: "Failed to get island page data" });
    }
  });
  
  // Get student island data by passport code
  app.get("/api/island/:passportCode", async (req, res) => {
    try {
      const { passportCode } = req.params;
      
      // Validate passport code format
      if (!isValidPassportCode(passportCode)) {
        return res.status(400).json({ message: "Invalid passport code format" });
      }

      // Find student by passport code
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
        .where(eq(quizSubmissions.passportCode, passportCode))
        .limit(1);

      if (studentData.length === 0) {
        return res.status(404).json({ message: "Student island not found" });
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
      res.status(500).json({ message: "Failed to get island data" });
    }
  });

  // Check store status for student's class
  app.get("/api/island/:passportCode/store", async (req, res) => {
    try {
      const { passportCode } = req.params;
      
      if (!isValidPassportCode(passportCode)) {
        return res.status(400).json({ message: "Invalid passport code format" });
      }

      // Get student's class to check store status
      const studentClass = await db
        .select({
          classId: classes.id,
          className: classes.name
        })
        .from(quizSubmissions)
        .innerJoin(classes, eq(quizSubmissions.classId, classes.id))
        .where(eq(quizSubmissions.passportCode, passportCode))
        .limit(1);

      if (studentClass.length === 0) {
        return res.status(404).json({ message: "Student not found" });
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
      res.status(500).json({ message: "Failed to get store status" });
    }
  });

  // Get available store catalog (shared endpoint, no auth needed)
  app.get("/api/store/catalog", async (req, res) => {
    try {
      // Import store items table and StorageRouter
      const { storeItems } = await import("@shared/schema");
      const { asc } = await import("drizzle-orm");
      const { default: StorageRouter } = await import("../services/storage-router");
      
      // Fetch active store items from database
      const items = await db
        .select()
        .from(storeItems)
        .where(eq(storeItems.isActive, true))
        .orderBy(asc(storeItems.sortOrder), asc(storeItems.name));
      
      // Use StorageRouter to prepare items with image URLs
      const preparedItems = await StorageRouter.prepareStoreItemsResponse(items);
      
      // Return catalog with imageUrl included
      const catalog = preparedItems.map(item => ({
        id: item.id,
        name: item.name,
        type: item.itemType,
        cost: item.cost,
        description: item.description,
        rarity: item.rarity,
        imageUrl: item.imageUrl // Include the image URL!
      }));

      res.json(catalog);
    } catch (error) {
      console.error("Get store catalog error:", error);
      res.status(500).json({ message: "Failed to get store catalog" });
    }
  });

  // Create purchase request
  app.post("/api/island/:passportCode/purchase", async (req, res) => {
    try {
      const { passportCode } = req.params;
      const { itemId } = req.body;
      
      // Validate passport code
      if (!isValidPassportCode(passportCode)) {
        return res.status(400).json({ message: "Invalid passport code format" });
      }

      // Get student data
      const studentData = await db
        .select({
          id: quizSubmissions.id,
          currencyBalance: quizSubmissions.currencyBalance,
          classId: quizSubmissions.classId
        })
        .from(quizSubmissions)
        .where(eq(quizSubmissions.passportCode, passportCode))
        .limit(1);

      if (studentData.length === 0) {
        return res.status(404).json({ message: "Student not found" });
      }

      const student = studentData[0];
      
      // Get item details from database
      const { storeItems } = await import("@shared/schema");
      const itemData = await db
        .select()
        .from(storeItems)
        .where(and(
          eq(storeItems.id, itemId),
          eq(storeItems.isActive, true)
        ))
        .limit(1);
      
      if (itemData.length === 0) {
        return res.status(400).json({ message: "Item not found in store" });
      }
      
      const item = itemData[0];
      
      // Validate student has enough balance
      if (student.currencyBalance < item.cost) {
        return res.status(400).json({ message: "Insufficient funds" });
      }

      // Check if store is open for the class
      const storeStatus = await db
        .select()
        .from(storeSettings)
        .where(eq(storeSettings.classId, student.classId))
        .limit(1);

      if (storeStatus.length === 0 || !storeStatus[0].isOpen) {
        return res.status(400).json({ message: "Store is currently closed" });
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
        return res.status(400).json({ message: "You already have a pending request for this item" });
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
          message: `Not enough available coins. You have ${availableBalance} coins available (${student.currencyBalance} total - ${totalPendingCost} pending).` 
        });
      }

      // Create purchase request
      const [purchaseRequest] = await db
        .insert(purchaseRequests)
        .values({
          studentId: student.id,
          itemType: item.itemType,
          itemId: itemId,
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
      res.status(500).json({ message: "Failed to create purchase request" });
    }
  });

  // Get student's purchase requests
  app.get("/api/island/:passportCode/purchases", async (req, res) => {
    try {
      const { passportCode } = req.params;
      
      if (!isValidPassportCode(passportCode)) {
        return res.status(400).json({ message: "Invalid passport code format" });
      }

      // Get student ID
      const studentData = await db
        .select({ id: quizSubmissions.id })
        .from(quizSubmissions)
        .where(eq(quizSubmissions.passportCode, passportCode))
        .limit(1);

      if (studentData.length === 0) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Get purchase requests
      const requests = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.studentId, studentData[0].id))
        .orderBy(desc(purchaseRequests.requestedAt));

      res.json(requests);
    } catch (error) {
      console.error("Get purchase requests error:", error);
      res.status(500).json({ message: "Failed to get purchase requests" });
    }
  });

  // Save island state endpoint
  app.post("/api/island/:passportCode/state", async (req, res) => {
    try {
      const { passportCode } = req.params;
      const { avatarData, roomData } = req.body;
      
      // Validate passport code
      if (!isValidPassportCode(passportCode)) {
        return res.status(400).json({ message: "Invalid passport code format" });
      }
      
      // Validate room item limit (50 items max)
      const ROOM_ITEM_LIMIT = 50;
      if (roomData?.furniture && roomData.furniture.length > ROOM_ITEM_LIMIT) {
        return res.status(400).json({ 
          message: `Room cannot have more than ${ROOM_ITEM_LIMIT} items. You have ${roomData.furniture.length} items.` 
        });
      }
      
      // Get student data
      const studentData = await db
        .select({
          id: quizSubmissions.id,
          avatarData: quizSubmissions.avatarData,
          roomData: quizSubmissions.roomData
        })
        .from(quizSubmissions)
        .where(eq(quizSubmissions.passportCode, passportCode))
        .limit(1);
      
      if (studentData.length === 0) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      const student = studentData[0];
      
      // Merge new data with existing data
      const updatedAvatarData = {
        ...student.avatarData,
        ...avatarData
      };
      
      const updatedRoomData = {
        ...student.roomData,
        ...roomData
      };
      
      // Update database
      await db
        .update(quizSubmissions)
        .set({
          avatarData: updatedAvatarData,
          roomData: updatedRoomData
        })
        .where(eq(quizSubmissions.id, student.id));
      
      res.json({
        message: "Island state saved successfully!",
        avatarData: updatedAvatarData,
        roomData: updatedRoomData
      });
    } catch (error) {
      console.error("Save island state error:", error);
      res.status(500).json({ message: "Failed to save island state" });
    }
  });

  // Equip/unequip items endpoint
  app.post("/api/island/:passportCode/equip", async (req, res) => {
    try {
      const { passportCode } = req.params;
      const { slot, itemId } = req.body;
      
      // Validate passport code
      if (!isValidPassportCode(passportCode)) {
        return res.status(400).json({ message: "Invalid passport code format" });
      }
      
      // Validate slot
      if (!['hat', 'glasses', 'accessory'].includes(slot)) {
        return res.status(400).json({ message: "Invalid equipment slot" });
      }
      
      // Get student data
      const studentData = await db
        .select({
          id: quizSubmissions.id,
          avatarData: quizSubmissions.avatarData
        })
        .from(quizSubmissions)
        .where(eq(quizSubmissions.passportCode, passportCode))
        .limit(1);
      
      if (studentData.length === 0) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      const student = studentData[0];
      const currentAvatarData = student.avatarData || {};
      const ownedItems = currentAvatarData.owned || [];
      const equippedItems = currentAvatarData.equipped || {};
      
      // If itemId is provided, verify ownership
      if (itemId && !ownedItems.includes(itemId)) {
        return res.status(400).json({ message: "You don't own this item" });
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
      res.status(500).json({ message: "Failed to equip item" });
    }
  });

}