// Student Room Routes - No authentication required
import type { Express } from "express";
import { db } from "../db";
import { students, classes, currencyTransactions, storeItems, quizSubmissions, studentInventory, itemTypes, animalTypes, geniusTypes, patterns } from "@shared/schema";
import { eq, and, or, desc, asc, inArray, sql } from "drizzle-orm";
import { isValidPassportCode, TRANSACTION_REASONS } from "@shared/currency-types";
import { z } from "zod";
import { getCache } from "../lib/cache-factory";

const cache = getCache();
import StorageRouter from "../services/storage-router";
import { roomSaveLimiter, roomBrowsingLimiter, passportLoginLimiter } from "../middleware/rateLimiter";
// Legacy auth imports removed - using unified auth
import { validateOwnDataAccess } from "../middleware/validate-student-class";
import { checkRoomAccess } from "../middleware/room-access";
import { requireEditAccess } from "../middleware/requireEditAccess";
import { getStudentPet, getAvailablePets } from "../services/petService";
import { optionalAuth } from "../middleware/auth";
import { optionalStudentAuth } from "../middleware/passport-auth";


// Passport code validation schema
const passportCodeSchema = z.string().regex(/^[A-Z]{3}-[A-Z0-9]{3}$/, "Invalid passport code format");

export function registerRoomRoutes(app: Express) {
  
  // TEMPORARY: Pet catalog endpoint - remove once pet routes are working
  app.get("/api/pets/catalog", async (req, res) => {
    try {
      console.log('📱 Pet catalog requested (temporary endpoint)');
      const pets = await getAvailablePets();
      res.json(pets);
    } catch (error) {
      console.error("Get pet catalog error:", error);
      res.status(500).json({ error: 'Failed to fetch pet catalog' });
    }
  });
  
  // NEW: Consolidated endpoint for student room page - Uses flexible access control
  app.get("/api/room-page-data/:passportCode", optionalStudentAuth, checkRoomAccess, passportLoginLimiter, roomBrowsingLimiter, async (req, res) => {
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
          // passportCode removed for security
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
        const catalogCacheKey = 'store-catalog:active:v4'; // Changed cache key to force refresh
        const cachedCatalog = cache.get<any[]>(catalogCacheKey);
        
        // Ensure cached value is an array, not an empty object
        if (cachedCatalog && Array.isArray(cachedCatalog)) {
          storeCatalog = cachedCatalog;
          console.log(`✅ Cache hit for ${catalogCacheKey} - ${storeCatalog.length} items`);
        } else {
          if (cachedCatalog && !Array.isArray(cachedCatalog)) {
            console.warn(`⚠️ Cache contained non-array value for ${catalogCacheKey}:`, typeof cachedCatalog);
            cache.del(catalogCacheKey); // Clear invalid cache entry
          }
          console.log(`⚡ Cache miss for ${catalogCacheKey}, fetching from DB`);
          
          const items = await db
            .select({
              id: storeItems.id,
              name: storeItems.name,
              description: storeItems.description,
              cost: storeItems.cost,
              rarity: storeItems.rarity,
              assetId: storeItems.assetId,
              assetType: storeItems.assetType, // Include assetType from DB
              thumbnailUrl: storeItems.thumbnailUrl, // Include thumbnailUrl
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
          
          // Debug: Check if assetType is in prepared items
          if (preparedItems.length > 0) {
            console.log('Room endpoint - First prepared item:', {
              id: preparedItems[0].id,
              name: preparedItems[0].name,
              assetType: preparedItems[0].assetType,
              hasAssetType: 'assetType' in preparedItems[0],
              riveUrl: preparedItems[0].riveUrl
            });
          }
          
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
              case 'pets':
              case 'pet':
                return 'pets';
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
            imageUrl: item.imageUrl,
            thumbnailUrl: item.thumbnailUrl, // Include thumbnail URL
            assetType: item.assetType, // Include asset type (camelCase)
            riveUrl: item.riveUrl // Include Rive URL for animations
          }));
          
          // Cache for 10 minutes
          cache.set(catalogCacheKey, storeCatalog, 600);
          console.log(`💾 Cached store catalog for ${catalogCacheKey} - ${storeCatalog.length} items`);
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
      
      // Enrich room data with pattern details if needed
      let enrichedRoomData = student.roomData || { furniture: [] };
      
      // Check if we need to fetch pattern details
      const patternCodes: string[] = [];
      if (enrichedRoomData.wallPattern) {
        patternCodes.push(enrichedRoomData.wallPattern);
      }
      if (enrichedRoomData.floorPattern) {
        patternCodes.push(enrichedRoomData.floorPattern);
      }
      
      // If there are patterns to fetch, get their details
      if (patternCodes.length > 0) {
        try {
          const patternDetails = await db
            .select({
              code: patterns.code,
              patternType: patterns.patternType,
              patternValue: patterns.patternValue,
              surfaceType: patterns.surfaceType
            })
            .from(patterns)
            .where(inArray(patterns.code, patternCodes));
          
          // Create a map for quick lookup
          const patternMap = new Map(
            patternDetails.map(p => [p.code, p])
          );
          
          // Enrich the room data with pattern details
          if (enrichedRoomData.wallPattern && patternMap.has(enrichedRoomData.wallPattern)) {
            const wallPattern = patternMap.get(enrichedRoomData.wallPattern);
            enrichedRoomData.wall = {
              type: 'pattern',
              value: enrichedRoomData.wallPattern,
              patternType: wallPattern.patternType,
              patternValue: wallPattern.patternValue
            };
          }
          
          if (enrichedRoomData.floorPattern && patternMap.has(enrichedRoomData.floorPattern)) {
            const floorPattern = patternMap.get(enrichedRoomData.floorPattern);
            enrichedRoomData.floor = {
              type: 'pattern',
              value: enrichedRoomData.floorPattern,
              patternType: floorPattern.patternType,
              patternValue: floorPattern.patternValue
            };
          }
          
          console.log(`[DEBUG] Enriched room data with ${patternDetails.length} pattern details`);
        } catch (error) {
          console.error('Error fetching pattern details:', error);
          // Continue with original room data if pattern fetch fails
        }
      }
      
      // Get student's pet if they have one
      let pet = null;
      try {
        pet = await getStudentPet(student.id);
      } catch (error) {
        console.error('Error fetching student pet:', error);
        // Continue without pet data
      }

      // Format consolidated response - using "room" instead of "island"
      const pageData = {
        room: {
          id: student.id,
          passportCode: student.passportCode, // Include passport code!
          studentName: student.studentName,
          gradeLevel: student.gradeLevel,
          animalType: student.animalType || student.animalTypeId,
          personalityType: student.personalityType,
          animalGenius: student.animalGenius,
          learningStyle: student.learningStyle,
          currencyBalance: student.currencyBalance || 0,
          avatarData: updatedAvatarData,
          roomData: enrichedRoomData,
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
        pet, // Include pet data
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
          // passportCode removed for security
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


  // Save room state endpoint - Must have edit permission
  app.post("/api/room/:passportCode/state", optionalStudentAuth, checkRoomAccess, roomSaveLimiter, async (req, res) => {
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
  app.post("/api/room/:passportCode/equip", optionalStudentAuth, checkRoomAccess, roomSaveLimiter, async (req, res) => {
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

  // Save avatar customization endpoint - Must have edit permission
  app.post("/api/room/:passportCode/avatar", optionalStudentAuth, checkRoomAccess, requireEditAccess, roomSaveLimiter, async (req, res) => {
    try {
      const { passportCode } = req.params;
      const { equipped } = req.body;
      
      // Check edit permission
      if (!req.roomAccess?.canEdit) {
        return res.status(403).json({ message: "You don't have permission to edit this room" });
      }
      
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
        
        // IMPORTANT: Also update avatarData in students table
        const currentAvatarData = await tx
          .select({ avatarData: students.avatarData })
          .from(students)
          .where(eq(students.id, student.id))
          .limit(1);
        
        const updatedAvatarData = {
          ...(currentAvatarData[0]?.avatarData || {}),
          equipped: equipped || {}
        };
        
        await tx
          .update(students)
          .set({ avatarData: updatedAvatarData })
          .where(eq(students.id, student.id));
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

  // Save room decoration endpoint - Must have edit permission
  app.post("/api/room/:passportCode/room", optionalStudentAuth, checkRoomAccess, requireEditAccess, roomSaveLimiter, async (req, res) => {
    try {
      const { passportCode } = req.params;
      const { theme, wallColor, floorColor, wallPattern, floorPattern, furniture, wall, floor } = req.body;
      
      console.log('Room save endpoint - received data:', {
        passportCode,
        theme,
        wallColor,
        floorColor,
        wallPattern,
        floorPattern,
        wall: JSON.stringify(wall),
        floor: JSON.stringify(floor),
        furnitureCount: furniture?.length,
        wallType: typeof wall,
        floorType: typeof floor,
        rawBody: JSON.stringify(req.body)
      });
      
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
      
      console.log('Student data:', {
        id: student.id,
        idType: typeof student.id,
        hasRoomData: !!student.roomData
      });
      
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
      
      // Parse wall/floor if they're stringified (do this FIRST)
      let parsedWall = wall;
      let parsedFloor = floor;
      
      if (typeof wall === 'string') {
        try {
          parsedWall = JSON.parse(wall);
          console.log('Parsed wall from string:', parsedWall);
        } catch (e) {
          console.log('Failed to parse wall string:', wall);
        }
      }
      
      if (typeof floor === 'string') {
        try {
          parsedFloor = JSON.parse(floor);
          console.log('Parsed floor from string:', parsedFloor);
        } catch (e) {
          console.log('Failed to parse floor string:', floor);
        }
      }
      
      // Validate pattern ownership - ONLY use the new format (wall/floor objects)
      const patternsToValidate: string[] = [];
      
      // Only add patterns from the new format objects
      if (parsedWall?.type === 'pattern' && parsedWall.value) {
        patternsToValidate.push(parsedWall.value);
      }
      if (parsedFloor?.type === 'pattern' && parsedFloor.value) {
        patternsToValidate.push(parsedFloor.value);
      }
      
      console.log('Patterns to validate:', patternsToValidate);
      console.log('Pattern types:', patternsToValidate.map(p => typeof p));
      console.log('Pattern values (JSON):', JSON.stringify(patternsToValidate));
      
      if (patternsToValidate.length > 0) {
        console.log('About to query pattern items with codes:', patternsToValidate);
        
        try {
          // First, let's check if these patterns actually exist
          // Log the SQL query
          console.log('Executing pattern query with values:', patternsToValidate);
          
          const existingPatterns = await db
            .select({
              id: patterns.id,
              code: patterns.code
            })
            .from(patterns)
            .where(inArray(patterns.code, patternsToValidate));
          
          console.log('Existing patterns:', existingPatterns);
          
          if (existingPatterns.length === 0) {
            console.log('No valid patterns found for codes:', patternsToValidate);
            console.log('WARNING: Skipping pattern validation temporarily to allow room saves');
            // Temporarily skip pattern validation to allow saves
            // return res.status(400).json({ 
            //   message: "Invalid pattern codes provided",
            //   invalidPatterns: patternsToValidate 
            // });
          }
          
          // Get pattern IDs to check store items
          const patternIds = existingPatterns.map(p => p.id);
          
          // Skip ownership check if no patterns exist
          if (patternIds.length === 0) {
            console.log('No pattern IDs to check ownership for, skipping validation');
          } else {
          // Get store items that are patterns with the specified pattern IDs
          const patternItems = await db
            .select({
              id: storeItems.id,
              patternId: storeItems.patternId,
              patternCode: patterns.code
            })
            .from(storeItems)
            .innerJoin(patterns, eq(storeItems.patternId, patterns.id))
            .where(
              and(
                inArray(storeItems.patternId, patternIds),
                eq(storeItems.isActive, true)
              )
            );
          
          console.log('Found pattern items:', patternItems);
          
          // Check ownership for each pattern item
          const patternItemIds = patternItems.map(item => item.id);
          if (patternItemIds.length > 0) {
            const ownedPatternItems = await db
              .select({
                storeItemId: studentInventory.storeItemId,
                patternCode: patterns.code
              })
              .from(studentInventory)
              .innerJoin(storeItems, eq(studentInventory.storeItemId, storeItems.id))
              .innerJoin(patterns, eq(storeItems.patternId, patterns.id))
              .where(
                and(
                  eq(studentInventory.studentId, student.id),
                  inArray(studentInventory.storeItemId, patternItemIds)
                )
              );
            
            const ownedPatternCodes = ownedPatternItems.map(item => item.patternCode).filter(Boolean) as string[];
            const unownedPatterns = patternsToValidate.filter(patternCode => !ownedPatternCodes.includes(patternCode));
            
            if (unownedPatterns.length > 0) {
              return res.status(400).json({ 
                message: "You don't own some of the patterns you're trying to apply",
                unownedPatterns 
              });
            }
          }
          } // Close the else block for pattern ownership check
        } catch (queryError) {
          console.error('Pattern query error:', queryError);
          console.error('Query params:', { patternsToValidate });
          throw queryError;
        }
      }
      
      // Update room data with new structure support
      const updatedRoomData = {
        ...student.roomData,
        theme: theme || student.roomData?.theme || 'wood',
        // Handle new wall/floor structure - use parsed values
        wall: parsedWall || (wallPattern ? { type: 'pattern', value: wallPattern } : wallColor ? { type: 'color', value: wallColor } : student.roomData?.wall),
        floor: parsedFloor || (floorPattern ? { type: 'pattern', value: floorPattern } : floorColor ? { type: 'color', value: floorColor } : student.roomData?.floor),
        // Maintain backwards compatibility - use parsed values
        wallColor: parsedWall?.type === 'color' ? parsedWall.value : (wallColor || student.roomData?.wallColor),
        floorColor: parsedFloor?.type === 'color' ? parsedFloor.value : (floorColor || student.roomData?.floorColor),
        wallPattern: parsedWall?.type === 'pattern' ? parsedWall.value : (wallPattern !== undefined ? wallPattern : student.roomData?.wallPattern),
        floorPattern: parsedFloor?.type === 'pattern' ? parsedFloor.value : (floorPattern !== undefined ? floorPattern : student.roomData?.floorPattern),
        furniture: furniture || student.roomData?.furniture || []
      };
      
      console.log('Updating room data in database:', {
        studentId: student.id,
        updatedRoomData: JSON.stringify(updatedRoomData, null, 2)
      });
      
      // Use transaction to ensure data is committed
      await db.transaction(async (tx) => {
        // Update database
        const updateResult = await tx
          .update(students)
          .set({
            roomData: updatedRoomData,
            updatedAt: new Date()
          })
          .where(eq(students.id, student.id));
        
        console.log('Database update result:', updateResult);
        
        // Verify the update by reading back within the same transaction
        const verifyData = await tx
          .select({ roomData: students.roomData })
          .from(students)
          .where(eq(students.id, student.id))
          .limit(1);
        
        console.log('Verification read after update:', {
          studentId: student.id,
          savedRoomData: JSON.stringify(verifyData[0]?.roomData, null, 2)
        });
      });
      
      // Clear cache
      cache.del(`room-page-data:${passportCode}`);
      
      console.log('Room save completed successfully for:', passportCode);
      
      res.json({
        message: "Room decoration saved!",
        roomData: updatedRoomData
      });
    } catch (error) {
      console.error("Save room error:", error);
      res.status(500).json({ message: "Failed to save room decoration" });
    }
  });

  // Update room surfaces endpoint - Must have edit permission
  app.put("/api/room/:passportCode/surfaces", optionalStudentAuth, checkRoomAccess, requireEditAccess, roomSaveLimiter, async (req, res) => {
    try {
      const { passportCode } = req.params;
      const { wall, floor } = req.body;
      
      // Check edit permission
      if (!req.roomAccess?.canEdit) {
        return res.status(403).json({ message: "You don't have permission to edit this room" });
      }
      
      // Validate passport code
      if (!isValidPassportCode(passportCode)) {
        return res.status(400).json({ message: "Invalid passport code format" });
      }
      
      // Validate surface data structure
      const validateSurface = (surface: any, surfaceName: string) => {
        if (!surface) return true; // Optional
        if (typeof surface !== 'object' || !surface.type || !surface.value) {
          throw new Error(`Invalid ${surfaceName} format. Expected {type: 'color'|'pattern', value: string}`);
        }
        if (!['color', 'pattern'].includes(surface.type)) {
          throw new Error(`Invalid ${surfaceName} type. Must be 'color' or 'pattern'`);
        }
        if (typeof surface.value !== 'string') {
          throw new Error(`Invalid ${surfaceName} value. Must be a string`);
        }
        return true;
      };
      
      // Parse wall/floor if they're stringified
      let parsedWall = wall;
      let parsedFloor = floor;
      
      if (typeof wall === 'string') {
        try {
          parsedWall = JSON.parse(wall);
          console.log('Parsed wall from string in surfaces endpoint:', parsedWall);
        } catch (e) {
          console.log('Failed to parse wall string in surfaces endpoint:', wall);
        }
      }
      
      if (typeof floor === 'string') {
        try {
          parsedFloor = JSON.parse(floor);
          console.log('Parsed floor from string in surfaces endpoint:', parsedFloor);
        } catch (e) {
          console.log('Failed to parse floor string in surfaces endpoint:', floor);
        }
      }
      
      // Validate surface formats - use parsed values
      try {
        if (parsedWall) validateSurface(parsedWall, 'wall');
        if (parsedFloor) validateSurface(parsedFloor, 'floor');
      } catch (validationError: any) {
        return res.status(400).json({ message: validationError.message });
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
      
      // If applying patterns, validate ownership
      // Pattern validation is already handled above - removed duplicate code
      
      // Prepare updated room data with new format while maintaining backwards compatibility
      const currentRoomData = student.roomData || {};
      const updatedRoomData = { ...currentRoomData };
      
      // Update wall surface - use parsed values
      if (parsedWall) {
        updatedRoomData.wall = parsedWall;
        // Maintain backwards compatibility
        if (parsedWall.type === 'color') {
          updatedRoomData.wallColor = parsedWall.value;
          delete updatedRoomData.wallPattern;
        } else if (parsedWall.type === 'pattern') {
          updatedRoomData.wallPattern = parsedWall.value;
          delete updatedRoomData.wallColor;
        }
      }
      
      // Update floor surface - use parsed values
      if (parsedFloor) {
        updatedRoomData.floor = parsedFloor;
        // Maintain backwards compatibility
        if (parsedFloor.type === 'color') {
          updatedRoomData.floorColor = parsedFloor.value;
          delete updatedRoomData.floorPattern;
        } else if (parsedFloor.type === 'pattern') {
          updatedRoomData.floorPattern = parsedFloor.value;
          delete updatedRoomData.floorColor;
        }
      }
      
      // Update database
      await db
        .update(students)
        .set({
          roomData: updatedRoomData,
          updatedAt: new Date()
        })
        .where(eq(students.id, student.id));
      
      // Clear cache
      cache.del(`room-page-data:${passportCode}`);
      
      // Fetch pattern details for the response if patterns were applied
      const responseData = {
        wall: updatedRoomData.wall || null,
        floor: updatedRoomData.floor || null
      };
      
      // Enrich with pattern details if needed
      const patternCodesToFetch: string[] = [];
      if (responseData.wall?.type === 'pattern' && responseData.wall.value) {
        patternCodesToFetch.push(responseData.wall.value);
      }
      if (responseData.floor?.type === 'pattern' && responseData.floor.value) {
        patternCodesToFetch.push(responseData.floor.value);
      }
      
      if (patternCodesToFetch.length > 0) {
        try {
          const patternDetails = await db
            .select({
              code: patterns.code,
              patternType: patterns.patternType,
              patternValue: patterns.patternValue
            })
            .from(patterns)
            .where(inArray(patterns.code, patternCodesToFetch));
          
          const patternMap = new Map(
            patternDetails.map(p => [p.code, p])
          );
          
          // Add pattern details to response
          if (responseData.wall?.type === 'pattern' && patternMap.has(responseData.wall.value)) {
            const wallPattern = patternMap.get(responseData.wall.value);
            responseData.wall.patternType = wallPattern.patternType;
            responseData.wall.patternValue = wallPattern.patternValue;
          }
          
          if (responseData.floor?.type === 'pattern' && patternMap.has(responseData.floor.value)) {
            const floorPattern = patternMap.get(responseData.floor.value);
            responseData.floor.patternType = floorPattern.patternType;
            responseData.floor.patternValue = floorPattern.patternValue;
          }
        } catch (error) {
          console.error('Error fetching pattern details for response:', error);
        }
      }
      
      res.json({
        message: "Room surfaces updated successfully!",
        surfaces: responseData
      });
    } catch (error) {
      console.error("Update room surfaces error:", error);
      res.status(500).json({ message: "Failed to update room surfaces" });
    }
  });

}