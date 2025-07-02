// Student Room Routes - No authentication required
import type { Express } from "express";
import { db } from "../db";
import { students, classes, currencyTransactions, storeItems, quizSubmissions, studentInventory, itemTypes, animalTypes, geniusTypes } from "@shared/schema";
import { eq, and, desc, asc, inArray, sql } from "drizzle-orm";
import { isValidPassportCode, TRANSACTION_REASONS } from "@shared/currency-types";
import { z } from "zod";
import * as cache from "../lib/cache";
import StorageRouter from "../services/storage-router";
import { roomSaveLimiter, roomBrowsingLimiter, passportLoginLimiter } from "../middleware/rateLimiter";
import { requireStudentSession, generateStudentSession } from "../middleware/student-auth";
import { validateOwnDataAccess } from "../middleware/validate-student-class";
import { checkRoomAccess } from "../middleware/room-access";


// Passport code validation schema
const passportCodeSchema = z.string().regex(/^[A-Z]{3}-[A-Z0-9]{3}$/, "Invalid passport code format");

export function registerRoomRoutes(app: Express) {
  
  // NEW: Consolidated endpoint for student room page - Uses flexible access control
  app.get("/api/room-page-data/:passportCode", checkRoomAccess, passportLoginLimiter, roomBrowsingLimiter, async (req, res) => {
    try {
      const { passportCode } = req.params;
      
      // Validate passport code format
      if (!isValidPassportCode(passportCode)) {
        return res.status(400).json({ message: "Invalid passport code format" });
      }

      // 1. Get student room data with class info
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
          passportCode: students.passportCode,
          className: classes.name,
          classId: classes.id,
          classCode: classes.classCode,
          roomVisibility: students.roomVisibility
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

      const student = studentData[0];

      // 2. Store is always open in direct purchase system
      const storeStatus = {
        isOpen: true,
        message: "Store is always open! Shop anytime with your coins!",
        classId: student.classId,
        className: student.className,
        isDirect: true
      };

      // 3. Get store catalog
      let storeCatalog = [];
      
      if (storeStatus.isOpen) {
        const catalogCacheKey = 'store-catalog:active:v3'; // Changed cache key to force refresh
        // Force cache miss for debugging
        cache.del(catalogCacheKey);
        console.log(`🗑️ Cleared cache for ${catalogCacheKey}`);
        storeCatalog = cache.get<any[]>(catalogCacheKey);
        
        if (!storeCatalog) {
          console.log(`⚡ Cache miss for ${catalogCacheKey}, fetching from DB`);
          
          const items = await db
            .select({
              id: storeItems.id,
              name: storeItems.name,
              description: storeItems.description,
              cost: storeItems.cost,
              rarity: storeItems.rarity,
              assetId: storeItems.assetId,
              sortOrder: storeItems.sortOrder,
              isActive: storeItems.isActive,
              itemType: itemTypes.category, // Get the category which matches frontend expectations
              createdAt: storeItems.createdAt,
              updatedAt: storeItems.updatedAt
            })
            .from(storeItems)
            .innerJoin(itemTypes, eq(storeItems.itemTypeId, itemTypes.id))
            .where(eq(storeItems.isActive, true))
            .orderBy(asc(storeItems.sortOrder), asc(storeItems.name));
            
          console.log(`🛍️ Found ${items.length} active store items`);
          if (items.length > 0) {
            console.log('Sample item:', items[0]);
          }
          
          // Use StorageRouter to prepare items with image URLs
          const preparedItems = await StorageRouter.prepareStoreItemsResponse(items);
          
          // Map item types to what the frontend expects
          const mapItemType = (itemType: string): string => {
            switch (itemType?.toLowerCase()) {
              case 'hat':
              case 'avatar_hat':
                return 'avatar_hat';
              case 'glasses':
              case 'avatar_glasses':
                return 'avatar_accessory'; // Glasses are treated as accessories in frontend
              case 'accessory':
              case 'avatar_accessory':
                return 'avatar_accessory';
              case 'room decoration':
              case 'room_decoration':
                return 'room_decoration';
              case 'furniture':
              case 'room_furniture':
                return 'room_furniture';
              case 'wallpaper':
              case 'room_wallpaper':
                return 'room_wallpaper';
              case 'flooring':
              case 'room_flooring':
                return 'room_flooring';
              default:
                console.log(`Unknown item type: ${itemType}`);
                return 'avatar_accessory'; // Default fallback
            }
          };

          storeCatalog = preparedItems.map(item => ({
            id: item.id,
            name: item.name,
            type: mapItemType(item.itemType),
            cost: item.cost,
            description: item.description,
            rarity: item.rarity,
            imageUrl: item.imageUrl
          }));
          
          // Cache for 10 minutes
          cache.set(catalogCacheKey, storeCatalog, 600);
          console.log(`💾 Cached store catalog for ${catalogCacheKey} - ${storeCatalog.length} items`);
        } else {
          console.log(`✅ Cache hit for ${catalogCacheKey} - ${storeCatalog?.length || 0} items`);
        }
      }

      // 4. No purchase requests in direct purchase system
      const studentPurchaseRequests = [];
      
      // No pending purchases in direct purchase system
      const wallet = {
        total: student.currencyBalance || 0,
        pending: 0,
        available: student.currencyBalance || 0
      };

      // 5. Get inventory items from student_inventory table
      let inventoryItems = [];
      
      try {
        // First, get the student's inventory items
        const studentInventoryData = await db
          .select()
          .from(studentInventory)
          .where(eq(studentInventory.studentId, student.id));

        // If we have inventory items, get their details from store_items
        if (studentInventoryData.length > 0) {
          const itemIds = studentInventoryData.map(inv => inv.storeItemId);
          
          const storeItemsData = await db
            .select({
              id: storeItems.id,
              name: storeItems.name,
              description: storeItems.description,
              cost: storeItems.cost,
              rarity: storeItems.rarity,
              assetId: storeItems.assetId,
              itemType: itemTypes.category // Get the category which matches frontend expectations
            })
            .from(storeItems)
            .innerJoin(itemTypes, eq(storeItems.itemTypeId, itemTypes.id))
            .where(inArray(storeItems.id, itemIds));

          // Create a map for quick lookup
          const storeItemsMap = new Map(
            storeItemsData.map(item => [item.id, item])
          );

          // Combine the data
          const inventoryData = studentInventoryData.map(invItem => {
            const storeItem = storeItemsMap.get(invItem.storeItemId);
            return {
              itemId: invItem.storeItemId,
              isEquipped: invItem.isEquipped,
              acquiredAt: invItem.acquiredAt,
              name: storeItem?.name || 'Unknown Item',
              description: storeItem?.description || '',
              itemType: storeItem?.itemType || 'unknown',
              cost: storeItem?.cost || 0,
              rarity: storeItem?.rarity || 'common',
              imageUrl: storeItem?.assetId || null
            };
          });

          // OPTIMIZATION: Batch process all image URLs at once to prevent N+1 queries
          const itemsWithAssets = inventoryData.filter(item => item.imageUrl);
          let preparedItems = [];
          
          if (itemsWithAssets.length > 0) {
            // Prepare all asset URLs in a single batch call
            const assetItems = itemsWithAssets.map(item => ({ 
              assetId: item.imageUrl,
              id: item.itemId // Include ID for mapping back
            }));
            preparedItems = await StorageRouter.prepareStoreItemsResponse(assetItems);
          }
          
          // Create a map for quick lookup
          const imageUrlMap = new Map(
            preparedItems.map((item: any) => [item.assetId, item.imageUrl])
          );

          // Transform inventory data to match frontend expectations
          inventoryItems = inventoryData.map(item => ({
            id: item.itemId,
            name: item.name,
            type: item.itemType,
            cost: item.cost,
            description: item.description,
            rarity: item.rarity,
            imageUrl: item.imageUrl ? imageUrlMap.get(item.imageUrl) || null : null,
            quantity: 1,
            obtainedAt: item.acquiredAt,
            isEquipped: item.isEquipped
          }));
        }
      } catch (error) {
        console.error('Error fetching inventory items:', error);
        // Set inventoryItems to empty array if query fails
        inventoryItems = [];
      }

      // Get equipped items for avatarData compatibility
      const equippedItems = inventoryItems
        .filter(item => item.isEquipped)
        .reduce((acc, item) => {
          // Map item types to slots
          const slot = item.type.replace('avatar_', ''); // e.g., avatar_hat -> hat
          acc[slot] = item.id;
          return acc;
        }, {} as Record<string, string>);

      // Update avatarData to include equipped items (for compatibility)
      const updatedAvatarData = {
        ...student.avatarData,
        equipped: equippedItems,
        owned: inventoryItems.map(item => item.id) // For legacy compatibility
      };

      // Debug log
      console.log(`[DEBUG] Student ${student.studentName} inventory:`, inventoryItems.length, 'items');
      
      // Format consolidated response - using "room" instead of "island"
      const pageData = {
        room: {
          id: student.id,
          passportCode: student.passportCode,
          studentName: student.studentName,
          gradeLevel: student.gradeLevel,
          animalType: student.animalType || student.animalTypeId,
          personalityType: student.personalityType,
          animalGenius: student.animalGenius,
          learningStyle: student.learningStyle,
          currencyBalance: student.currencyBalance || 0,
          avatarData: updatedAvatarData,
          roomData: student.roomData || { furniture: [] },
          className: student.className,
          classId: student.classId,
          classCode: student.classCode,
          createdAt: student.createdAt,
          inventoryItems, // Add this field that the frontend expects
          roomVisibility: student.roomVisibility || 'class' // Include visibility setting
        },
        wallet,
        storeStatus,
        storeCatalog,
        purchaseRequests: studentPurchaseRequests,
        // Include access information for frontend
        access: {
          canView: req.roomAccess?.canView || false,
          canEdit: req.roomAccess?.canEdit || false,
          isOwner: req.roomAccess?.isOwner || false,
          isTeacher: req.roomAccess?.isTeacher || false
        }
      };

      res.json(pageData);
    } catch (error) {
      console.error("Get room page data error:", error);
      res.status(500).json({ message: "Failed to get room page data" });
    }
  });
  
  // Get student room data by passport code
  app.get("/api/room/:passportCode", roomBrowsingLimiter, async (req, res) => {
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
          animalTypeId: students.animalTypeId,
          geniusTypeId: students.geniusTypeId,
          animalType: animalTypes.name,
          animalGenius: geniusTypes.name,
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
        .leftJoin(animalTypes, eq(students.animalTypeId, animalTypes.id))
        .leftJoin(geniusTypes, eq(students.geniusTypeId, geniusTypes.id))
        .where(eq(students.passportCode, passportCode))
        .limit(1);

      if (studentData.length === 0) {
        return res.status(404).json({ message: "Student room not found" });
      }

      const student = studentData[0];

      // Format response for student room
      const roomData = {
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

      res.json(roomData);
    } catch (error) {
      console.error("Get room data error:", error);
      res.status(500).json({ message: "Failed to get room data" });
    }
  });

  // Check store status for student's class
  app.get("/api/room/:passportCode/store", async (req, res) => {
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
      res.status(500).json({ message: "Failed to get store status" });
    }
  });

  // Create purchase request (redirects to direct purchase)
  app.post("/api/room/:passportCode/purchase", async (req, res) => {
    // Direct to the store-direct endpoint
    return res.status(400).json({ 
      message: "Please use /api/store-direct/purchase instead.",
      redirect: "/api/store-direct/purchase"
    });
  });

  // Get student's purchase requests (returns empty in direct system)
  app.get("/api/room/:passportCode/purchases", async (req, res) => {
    // Purchase requests no longer exist in direct purchase system
    res.json([]);
  });

  // Save room state endpoint - Must have edit permission
  app.post("/api/room/:passportCode/state", checkRoomAccess, roomSaveLimiter, async (req, res) => {
    try {
      const { passportCode } = req.params;
      const { avatarData, roomData, lastUpdated } = req.body;
      
      // Check edit permission
      if (!req.roomAccess?.canEdit) {
        return res.status(403).json({ message: "You don't have permission to edit this room" });
      }
      
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
      
      // Get student data with current update timestamp
      const studentData = await db
        .select({
          id: students.id,
          avatarData: students.avatarData,
          roomData: students.roomData,
          updatedAt: students.updatedAt
        })
        .from(students)
        .where(eq(students.passportCode, passportCode))
        .limit(1);
      
      if (studentData.length === 0) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      const student = studentData[0];
      
      // Improved optimistic locking: check if data was modified by another request
      if (lastUpdated && student.updatedAt) {
        const clientLastUpdated = new Date(lastUpdated).getTime();
        const serverLastUpdated = new Date(student.updatedAt).getTime();
        
        // Use millisecond precision and account for small clock differences
        const timeDifference = serverLastUpdated - clientLastUpdated;
        
        if (timeDifference > 1000) { // More than 1 second difference indicates conflict
          console.log(`🔒 Optimistic lock conflict detected for ${passportCode}: client=${new Date(clientLastUpdated).toISOString()}, server=${new Date(serverLastUpdated).toISOString()}`);
          
          return res.status(409).json({ 
            message: "Room data has been modified by another session. Please refresh and try again.",
            conflict: true,
            serverData: {
              avatarData: student.avatarData,
              roomData: student.roomData,
              updatedAt: student.updatedAt
            }
          });
        }
      }
      
      // Merge new data with existing data
      const updatedAvatarData = {
        ...student.avatarData,
        ...avatarData
      };
      
      const updatedRoomData = {
        ...student.roomData,
        ...roomData
      };
      
      // Update database with new timestamp
      const now = new Date();
      await db
        .update(students)
        .set({
          avatarData: updatedAvatarData,
          roomData: updatedRoomData,
          updatedAt: now
        })
        .where(eq(students.id, student.id));
      
      // Clear cache
      cache.del(`room-page-data:${passportCode}`);
      
      res.json({
        message: "Room state saved successfully!",
        avatarData: updatedAvatarData,
        roomData: updatedRoomData,
        updatedAt: now.toISOString()
      });
    } catch (error) {
      console.error("Save room state error:", error);
      res.status(500).json({ message: "Failed to save room state" });
    }
  });

  // Equip/unequip items endpoint - Must have edit permission
  app.post("/api/room/:passportCode/equip", checkRoomAccess, roomSaveLimiter, async (req, res) => {
    try {
      const { passportCode } = req.params;
      const { slot, itemId } = req.body;
      
      // Check edit permission
      if (!req.roomAccess?.canEdit) {
        return res.status(403).json({ message: "You don't have permission to edit this room" });
      }
      
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
          id: students.id
        })
        .from(students)
        .where(eq(students.passportCode, passportCode))
        .limit(1);
      
      if (studentData.length === 0) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      const student = studentData[0];
      
      // If itemId is provided, verify ownership in student_inventory
      if (itemId) {
        const ownership = await db
          .select()
          .from(studentInventory)
          .where(
            and(
              eq(studentInventory.studentId, student.id),
              eq(studentInventory.storeItemId, itemId)
            )
          )
          .limit(1);
        
        if (ownership.length === 0) {
          return res.status(400).json({ message: "You don't own this item" });
        }
      }
      
      // Start transaction to update equipped status
      await db.transaction(async (tx) => {
        // First, unequip any item currently in this slot
        const itemsInSlot = await tx
          .select({
            storeItemId: studentInventory.storeItemId,
            itemType: storeItems.itemType
          })
          .from(studentInventory)
          .innerJoin(storeItems, eq(studentInventory.storeItemId, storeItems.id))
          .where(
            and(
              eq(studentInventory.studentId, student.id),
              eq(studentInventory.isEquipped, true),
              eq(storeItems.itemTypeId, `avatar_${slot}`)
            )
          );
        
        // Unequip items in the slot
        for (const item of itemsInSlot) {
          await tx
            .update(studentInventory)
            .set({ isEquipped: false })
            .where(
              and(
                eq(studentInventory.studentId, student.id),
                eq(studentInventory.storeItemId, item.storeItemId)
              )
            );
        }
        
        // Equip the new item if provided
        if (itemId) {
          await tx
            .update(studentInventory)
            .set({ isEquipped: true })
            .where(
              and(
                eq(studentInventory.studentId, student.id),
                eq(studentInventory.storeItemId, itemId)
              )
            );
        }
      });
      
      // Clear cache
      cache.del(`room-page-data:${passportCode}`);
      
      res.json({
        message: itemId ? "Item equipped!" : "Item unequipped!"
      });
    } catch (error) {
      console.error("Equip item error:", error);
      res.status(500).json({ message: "Failed to equip item" });
    }
  });

  // Save avatar customization endpoint
  app.post("/api/room/:passportCode/avatar", roomSaveLimiter, async (req, res) => {
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
          id: students.id
        })
        .from(students)
        .where(eq(students.passportCode, passportCode))
        .limit(1);
      
      if (studentData.length === 0) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      const student = studentData[0];
      
      // Validate all equipped items are owned
      const equippedItemIds = Object.values(equipped || {}).filter(Boolean) as string[];
      
      if (equippedItemIds.length > 0) {
        const ownedItems = await db
          .select({ storeItemId: studentInventory.storeItemId })
          .from(studentInventory)
          .where(
            and(
              eq(studentInventory.studentId, student.id),
              inArray(studentInventory.storeItemId, equippedItemIds)
            )
          );
        
        const ownedItemIds = ownedItems.map(item => item.storeItemId);
        const unownedItems = equippedItemIds.filter(itemId => !ownedItemIds.includes(itemId));
        
        if (unownedItems.length > 0) {
          return res.status(400).json({ 
            message: "You don't own some of the items you're trying to equip",
            unownedItems 
          });
        }
      }
      
      // Update equipped status in transaction
      await db.transaction(async (tx) => {
        // First, unequip all items
        await tx
          .update(studentInventory)
          .set({ isEquipped: false })
          .where(eq(studentInventory.studentId, student.id));
        
        // Then equip the specified items
        for (const itemId of equippedItemIds) {
          await tx
            .update(studentInventory)
            .set({ isEquipped: true })
            .where(
              and(
                eq(studentInventory.studentId, student.id),
                eq(studentInventory.storeItemId, itemId)
              )
            );
        }
      });
      
      // Clear cache
      cache.del(`room-page-data:${passportCode}`);
      
      res.json({
        message: "Avatar customization saved!"
      });
    } catch (error) {
      console.error("Save avatar error:", error);
      res.status(500).json({ message: "Failed to save avatar customization" });
    }
  });

  // Save room decoration endpoint
  app.post("/api/room/:passportCode/room", roomSaveLimiter, async (req, res) => {
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
          roomData: students.roomData
        })
        .from(students)
        .where(eq(students.passportCode, passportCode))
        .limit(1);
      
      if (studentData.length === 0) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      const student = studentData[0];
      
      // Validate all furniture items are owned
      if (furniture && furniture.length > 0) {
        const furnishingItemIds = furniture.map((item: any) => item.itemId);
        
        const ownedItems = await db
          .select({ storeItemId: studentInventory.storeItemId })
          .from(studentInventory)
          .where(
            and(
              eq(studentInventory.studentId, student.id),
              inArray(studentInventory.storeItemId, furnishingItemIds)
            )
          );
        
        const ownedItemIds = ownedItems.map(item => item.storeItemId);
        const unownedItems = furnishingItemIds.filter((itemId: string) => !ownedItemIds.includes(itemId));
        
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
      
      // Clear cache
      cache.del(`room-page-data:${passportCode}`);
      
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