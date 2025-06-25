// Student Island Routes - No authentication required
import type { Express } from "express";
import { db } from "../db";
import { students, classes, purchaseRequests, currencyTransactions, storeSettings, storeItems, quizSubmissions } from "@shared/schema";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { isValidPassportCode, TRANSACTION_REASONS } from "@shared/currency-types";
import { z } from "zod";
import * as cache from "../lib/cache";
import StorageRouter from "../services/storage-router";

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
          id: students.id,
          studentName: students.studentName,
          gradeLevel: students.gradeLevel,
          personalityType: students.personalityType,
          animalType: students.animalType,
          animalGenius: students.animalGenius,
          learningStyle: students.learningStyle,
          currencyBalance: students.currencyBalance,
          avatarData: students.avatarData,
          roomData: students.roomData,
          createdAt: students.createdAt,
          passportCode: students.passportCode,
          className: classes.name,
          classId: classes.id
        })
        .from(students)
        .innerJoin(classes, eq(students.classId, classes.id))
        .where(eq(students.passportCode, passportCode))
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

      // 3. Get store catalog ONLY if store is open
      let storeCatalog = [];
      
      if (storeStatus.isOpen) {
        const catalogCacheKey = 'store-catalog:active';
        storeCatalog = cache.get<any[]>(catalogCacheKey);
        
        if (!storeCatalog) {
          console.log(`⚡ Cache miss for ${catalogCacheKey}, fetching from DB`);
          
          const items = await db
            .select()
            .from(storeItems)
            .where(eq(storeItems.isActive, true))
            .orderBy(asc(storeItems.sortOrder), asc(storeItems.name));
          
          // Use StorageRouter to prepare items with image URLs
          const preparedItems = await StorageRouter.prepareStoreItemsResponse(items);
          
          storeCatalog = preparedItems.map(item => ({
            id: item.id,
            name: item.name,
            type: item.itemType,
            cost: item.cost,
            description: item.description,
            rarity: item.rarity,
            imageUrl: item.imageUrl
          }));
          
          // Cache for 10 minutes
          cache.set(catalogCacheKey, storeCatalog, 600);
          console.log(`💾 Cached store catalog for ${catalogCacheKey}`);
        } else {
          console.log(`✅ Cache hit for ${catalogCacheKey}`);
        }
      } else {
        console.log(`🚫 Store is closed, skipping catalog load`);
      }

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
          createdAt: student.createdAt,
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
          id: students.id,
          studentName: students.studentName,
          gradeLevel: students.gradeLevel,
          personalityType: students.personalityType,
          animalType: students.animalType,
          animalGenius: students.animalGenius,
          learningStyle: students.learningStyle,
          currencyBalance: students.currencyBalance,
          avatarData: students.avatarData,
          roomData: students.roomData,
          createdAt: students.createdAt,
          passportCode: students.passportCode,
          // Class info
          className: classes.name,
          classId: classes.id
        })
        .from(students)
        .innerJoin(classes, eq(students.classId, classes.id))
        .where(eq(students.passportCode, passportCode))
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
        createdAt: student.createdAt
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
        .from(students)
        .innerJoin(classes, eq(students.classId, classes.id))
        .where(eq(students.passportCode, passportCode))
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
      // Use imports from top of file
      
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
          id: students.id,
          currencyBalance: students.currencyBalance,
          classId: students.classId
        })
        .from(students)
        .where(eq(students.passportCode, passportCode))
        .limit(1);

      if (studentData.length === 0) {
        return res.status(404).json({ message: "Student not found" });
      }

      const student = studentData[0];
      
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
      
      const storeSettingsData = storeStatus[0];
      
      // Get class info for teacher ID
      const [classInfo] = await db
        .select()
        .from(classes)
        .where(eq(classes.id, student.classId))
        .limit(1);
      
      if (!classInfo) {
        console.error(`Class not found for student ${student.id} with classId ${student.classId}`);
        return res.status(500).json({ message: "Class configuration error" });
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

      // Check if item qualifies for auto-approval
      const autoApprovalThreshold = storeSettingsData.autoApprovalThreshold;
      const shouldAutoApprove = autoApprovalThreshold !== null && item.cost <= autoApprovalThreshold;
      
      // Create purchase request
      const [purchaseRequest] = await db
        .insert(purchaseRequests)
        .values({
          studentId: student.id,
          itemType: item.itemType,
          itemId: itemId,
          cost: item.cost,
          status: shouldAutoApprove ? 'approved' : 'pending',
          processedAt: shouldAutoApprove ? new Date() : null,
          processedBy: shouldAutoApprove ? classInfo.teacherId : null // Use teacher ID instead of -1
        })
        .returning();

      // If auto-approved, process the purchase immediately
      if (shouldAutoApprove) {
        // Start transaction to update balance and add item
        await db.transaction(async (tx) => {
          // Get current avatar data
          const currentStudent = await tx
            .select({ avatarData: students.avatarData })
            .from(students)
            .where(eq(students.id, student.id))
            .limit(1);
          
          const currentAvatarData = currentStudent[0]?.avatarData || {};
          const currentOwnedItems = currentAvatarData.owned || [];
          
          // Add item to owned items if not already owned
          const newOwnedItems = currentOwnedItems.includes(itemId)
            ? currentOwnedItems
            : [...currentOwnedItems, itemId];
          
          // Update student balance and avatar data atomically
          const result = await tx
            .update(students)
            .set({
              currencyBalance: sql`${students.currencyBalance} - ${item.cost}`,
              avatarData: {
                ...currentAvatarData,
                owned: newOwnedItems
              }
            })
            .where(and(
              eq(students.id, student.id),
              sql`${students.currencyBalance} >= ${item.cost}` // Ensure balance is sufficient AT THE TIME of update
            ))
            .returning();
          
          // If the update affected 0 rows, it means the balance was insufficient
          if (result.length === 0) {
            throw new Error("Insufficient funds");
          }

          // Create currency transaction record
          await tx
            .insert(currencyTransactions)
            .values({
              studentId: student.id,
              teacherId: classInfo.teacherId, // Use the actual teacher ID from class
              amount: -item.cost,
              reason: `Auto-approved purchase: ${item.name}`,
              transactionType: 'purchase'
            });
        });
        
        // Clear caches to reflect the changes
        const cacheKey = `island-page-data:${passportCode}`;
        cache.del(cacheKey);
        
        res.json({
          message: `Purchase auto-approved! ${item.name} has been added to your inventory.`,
          request: purchaseRequest,
          autoApproved: true
        });
      } else {
        res.json({
          message: "Purchase request submitted! Waiting for teacher approval.",
          request: purchaseRequest,
          autoApproved: false
        });
      }
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
        .select({ id: students.id })
        .from(students)
        .where(eq(students.passportCode, passportCode))
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
          id: students.id,
          avatarData: students.avatarData,
          roomData: students.roomData
        })
        .from(students)
        .where(eq(students.passportCode, passportCode))
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
        .update(students)
        .set({
          avatarData: updatedAvatarData,
          roomData: updatedRoomData
        })
        .where(eq(students.id, student.id));
      
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
          id: students.id,
          avatarData: students.avatarData
        })
        .from(students)
        .where(eq(students.passportCode, passportCode))
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
        .update(students)
        .set({
          avatarData: {
            ...currentAvatarData,
            equipped: newEquipped
          }
        })
        .where(eq(students.id, student.id));
      
      res.json({
        message: itemId ? "Item equipped!" : "Item unequipped!",
        equipped: newEquipped
      });
    } catch (error) {
      console.error("Equip item error:", error);
      res.status(500).json({ message: "Failed to equip item" });
    }
  });

  // Save avatar customization endpoint
  app.post("/api/island/:passportCode/avatar", async (req, res) => {
    try {
      const { passportCode } = req.params;
      const { equipped } = req.body;
      
      // Validate passport code
      if (!isValidPassportCode(passportCode)) {
        return res.status(400).json({ message: "Invalid passport code format" });
      }
      
      // Get student data
      const studentData = await db
        .select({
          id: students.id,
          avatarData: students.avatarData
        })
        .from(students)
        .where(eq(students.passportCode, passportCode))
        .limit(1);
      
      if (studentData.length === 0) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      const student = studentData[0];
      const currentAvatarData = student.avatarData || {};
      const ownedItems = currentAvatarData.owned || [];
      
      // Validate all equipped items are owned
      const equippedItemIds = Object.values(equipped || {}).filter(Boolean) as string[];
      const unownedItems = equippedItemIds.filter(itemId => !ownedItems.includes(itemId));
      
      if (unownedItems.length > 0) {
        return res.status(400).json({ 
          message: "You don't own some of the items you're trying to equip",
          unownedItems 
        });
      }
      
      // Update avatar data with new equipped items
      const updatedAvatarData = {
        ...currentAvatarData,
        equipped: equipped || {}
      };
      
      // Update database
      await db
        .update(students)
        .set({
          avatarData: updatedAvatarData
        })
        .where(eq(students.id, student.id));
      
      res.json({
        message: "Avatar customization saved!",
        avatarData: updatedAvatarData
      });
    } catch (error) {
      console.error("Save avatar error:", error);
      res.status(500).json({ message: "Failed to save avatar customization" });
    }
  });

  // Save room decoration endpoint
  app.post("/api/island/:passportCode/room", async (req, res) => {
    try {
      const { passportCode } = req.params;
      const { theme, wallColor, floorColor, wallPattern, floorPattern, furniture } = req.body;
      
      // Validate passport code
      if (!isValidPassportCode(passportCode)) {
        return res.status(400).json({ message: "Invalid passport code format" });
      }
      
      // Validate room item limit (50 items max)
      const ROOM_ITEM_LIMIT = 50;
      if (furniture && furniture.length > ROOM_ITEM_LIMIT) {
        return res.status(400).json({ 
          message: `Room cannot have more than ${ROOM_ITEM_LIMIT} items. You have ${furniture.length} items.` 
        });
      }
      
      // Get student data
      const studentData = await db
        .select({
          id: students.id,
          roomData: students.roomData,
          avatarData: students.avatarData
        })
        .from(students)
        .where(eq(students.passportCode, passportCode))
        .limit(1);
      
      if (studentData.length === 0) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      const student = studentData[0];
      const ownedItems = student.avatarData?.owned || [];
      
      // Validate all furniture items are owned
      if (furniture && furniture.length > 0) {
        const furnishingItemIds = furniture.map((item: any) => item.itemId);
        const unownedItems = furnishingItemIds.filter((itemId: string) => !ownedItems.includes(itemId));
        
        if (unownedItems.length > 0) {
          return res.status(400).json({ 
            message: "You don't own some of the items you're trying to place",
            unownedItems 
          });
        }
      }
      
      // Update room data
      const updatedRoomData = {
        ...student.roomData,
        theme: theme || student.roomData?.theme || 'wood',
        wallColor: wallColor || student.roomData?.wallColor,
        floorColor: floorColor || student.roomData?.floorColor,
        wallPattern: wallPattern !== undefined ? wallPattern : student.roomData?.wallPattern,
        floorPattern: floorPattern !== undefined ? floorPattern : student.roomData?.floorPattern,
        furniture: furniture || []
      };
      
      // Update database
      await db
        .update(students)
        .set({
          roomData: updatedRoomData
        })
        .where(eq(students.id, student.id));
      
      res.json({
        message: "Room decoration saved!",
        roomData: updatedRoomData
      });
    } catch (error) {
      console.error("Save room error:", error);
      res.status(500).json({ message: "Failed to save room decoration" });
    }
  });

}