// Student API Routes - Uses passport code authentication system
import type { Express } from "express";
import { db } from "../db";
import { 
  students, 
  classes, 
  currencyTransactions, 
  storeSettings, 
  storeItems, 
  studentInventory, 
  animalTypes, 
  geniusTypes, 
  itemTypes 
} from "@shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { TRANSACTION_REASONS } from "@shared/currency-types";
import { z } from "zod";
import { getCache } from "../lib/cache-factory";

const cache = getCache();
import StorageRouter from "../services/storage-router";
import { requireStudentSession } from "../middleware/student-auth";
import { 
  roomUpdateRequestSchema, 
  avatarUpdateRequestSchema,
  validateItemOwnership,
  validateAvatarOwnership,
  sanitizeRoomData,
  sanitizeAvatarData
} from "../validation/room-schemas";

// Student authentication schemas

const equipItemSchema = z.object({
  slot: z.string(),
  itemId: z.string().uuid().optional(),
});

export function registerStudentApiRoutes(app: Express) {
  
  // Get student dashboard/room data
  app.get("/api/student/dashboard", requireStudentSession, async (req, res) => {
    try {
      const studentId = req.studentId;
      
      // Check cache first
      const cacheKey = `student:${studentId}:dashboard`;
      const cached = await cache.get(cacheKey);
      
      if (cached) {
        console.log(`Cache hit for student dashboard: ${studentId}`);
        return res.json(cached);
      }

      // 1. Get student data with class info and type lookups
      const studentData = await db
        .select({
          id: students.id,
          studentName: students.studentName,
          gradeLevel: students.gradeLevel,
          personalityType: students.personalityType,
          animalTypeId: students.animalTypeId,
          animalTypeName: animalTypes.name,
          animalTypeCode: animalTypes.code,
          geniusTypeId: students.geniusTypeId,
          geniusTypeName: geniusTypes.name,
          geniusTypeCode: geniusTypes.code,
          learningStyle: students.learningStyle,
          currencyBalance: students.currencyBalance,
          avatarData: students.avatarData,
          roomData: students.roomData,
          className: classes.name,
          classId: classes.id,
          createdAt: students.createdAt,
        })
        .from(students)
        .innerJoin(classes, eq(students.classId, classes.id))
        .leftJoin(animalTypes, eq(students.animalTypeId, animalTypes.id))
        .leftJoin(geniusTypes, eq(students.geniusTypeId, geniusTypes.id))
        .where(eq(students.id, studentId))
        .limit(1);

      if (studentData.length === 0) {
        return res.status(404).json({ message: "Student not found" });
      }

      const student = studentData[0];

      // 2. Get store status for the class
      const storeSettingsData = await db
        .select()
        .from(storeSettings)
        .where(eq(storeSettings.classId, student.classId))
        .limit(1);

      let storeStatus = {
        isOpen: false,
        message: "Store is currently closed. Your teacher will announce when it opens!",
        classId: student.classId,
        className: student.className
      };

      if (storeSettingsData.length > 0) {
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
          className: student.className
        };
      }

      // 3. Get store catalog if store is open
      let storeCatalog: any[] = [];
      
      if (storeStatus.isOpen) {
        const items = await db
          .select({
            id: storeItems.id,
            name: storeItems.name,
            description: storeItems.description,
            itemTypeId: storeItems.itemTypeId,
            itemTypeCode: itemTypes.code,
            itemTypeCategory: itemTypes.category,
            cost: storeItems.cost,
            rarity: storeItems.rarity,
            assetId: storeItems.assetId,
            sortOrder: storeItems.sortOrder
          })
          .from(storeItems)
          .innerJoin(itemTypes, eq(storeItems.itemTypeId, itemTypes.id))
          .where(eq(storeItems.isActive, true))
          .orderBy(asc(storeItems.sortOrder), asc(storeItems.name));
        
        // Use StorageRouter to prepare items with image URLs
        const preparedItems = await StorageRouter.prepareStoreItemsResponse(items);
        
        storeCatalog = preparedItems.map((item: any) => ({
          id: item.id,
          name: item.name,
          type: item.itemTypeIdCode,
          cost: item.cost,
          description: item.description,
          rarity: item.rarity,
          imageUrl: item.imageUrl
        }));
      }

      // 4. Calculate wallet (no pending in direct purchase system)
      const wallet = {
        total: student.currencyBalance || 0,
        pending: 0,
        available: student.currencyBalance || 0
      };

      // 5. Get inventory items
      const inventoryData = await db
        .select({
          itemId: studentInventory.storeItemId,
          isEquipped: studentInventory.isEquipped,
          acquiredAt: studentInventory.acquiredAt,
          name: storeItems.name,
          description: storeItems.description,
          itemTypeCode: itemTypes.code,
          cost: storeItems.cost,
          rarity: storeItems.rarity,
          assetId: storeItems.assetId
        })
        .from(studentInventory)
        .innerJoin(storeItems, eq(studentInventory.storeItemId, storeItems.id))
        .innerJoin(itemTypes, eq(storeItems.itemTypeId, itemTypes.id))
        .where(eq(studentInventory.studentId, student.id));

      // Prepare inventory items with image URLs
      const preparedInventory = await StorageRouter.prepareStoreItemsResponse(
        inventoryData.map(item => ({
          id: item.itemId,
          name: item.name,
          description: item.description,
          itemTypeCode: item.itemTypeIdCode,
          cost: item.cost,
          rarity: item.rarity,
          assetId: item.assetId,
          isEquipped: item.isEquipped,
          acquiredAt: item.acquiredAt
        }))
      );

      // Prepare response
      const response = {
        success: true,
        data: {
          student: {
            id: student.id,
            studentName: student.studentName,
            animalType: {
              id: student.animalTypeId,
              name: student.animalTypeName,
              code: student.animalTypeCode
            },
            geniusType: {
              id: student.geniusTypeId,
              name: student.geniusTypeName,
              code: student.geniusTypeCode
            },
            personalityType: student.personalityType,
            learningStyle: student.learningStyle,
            gradeLevel: student.gradeLevel,
            currencyBalance: student.currencyBalance || 0,
            avatarData: student.avatarData || {},
            roomData: student.roomData || { furniture: [] },
            className: student.className,
            classId: student.classId
          },
          store: storeStatus,
          catalog: storeCatalog,
          wallet: wallet,
          inventory: preparedInventory,
        }
      };
      
      // Cache the response for 5 minutes
      await cache.set(cacheKey, response, 300);
      console.log(`Cached student dashboard for: ${studentId}`);
      
      // Return response
      res.json(response);

    } catch (error) {
      console.error("Error fetching student dashboard:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to load student dashboard" 
      });
    }
  });


  // Update avatar data
  app.post("/api/student/avatar", requireStudentSession, async (req, res) => {
    try {
      const studentId = req.studentId;
      
      // Validate request body
      const validationResult = avatarUpdateRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid avatar data",
          errors: validationResult.error.errors.map(e => e.message)
        });
      }
      
      const { avatarData } = validationResult.data;
      
      // Get student's owned items
      const ownedItems = await db
        .select({ itemId: studentInventory.storeItemId })
        .from(studentInventory)
        .where(eq(studentInventory.studentId, studentId));
      
      const ownedItemIds = ownedItems.map(item => item.itemId);
      
      // Validate ownership of equipped items
      const ownershipValidation = validateAvatarOwnership(avatarData, ownedItemIds);
      if (!ownershipValidation.valid) {
        return res.status(400).json({
          success: false,
          message: "Cannot equip items you don't own",
          errors: ownershipValidation.errors
        });
      }
      
      // Sanitize data before saving
      const sanitizedData = sanitizeAvatarData(avatarData);

      await db
        .update(students)
        .set({ avatarData: sanitizedData })
        .where(eq(students.id, studentId));

      res.json({
        success: true,
        message: "Avatar updated successfully"
      });

    } catch (error) {
      console.error("Error updating avatar:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to update avatar" 
      });
    }
  });

  // Update room data  
  app.post("/api/student/room", requireStudentSession, async (req, res) => {
    try {
      const studentId = req.studentId;
      
      // Validate request body
      const validationResult = roomUpdateRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid room data",
          errors: validationResult.error.errors.map(e => e.message)
        });
      }
      
      const { roomData } = validationResult.data;
      
      // Get student's owned items
      const ownedItems = await db
        .select({ itemId: studentInventory.storeItemId })
        .from(studentInventory)
        .where(eq(studentInventory.studentId, studentId));
      
      const ownedItemIds = ownedItems.map(item => item.itemId);
      
      // Validate ownership of room items
      const ownershipValidation = await validateItemOwnership(studentId, roomData, ownedItemIds);
      if (!ownershipValidation.valid) {
        return res.status(400).json({
          success: false,
          message: "Cannot place items you don't own",
          errors: ownershipValidation.errors
        });
      }
      
      // Sanitize data before saving
      const sanitizedData = sanitizeRoomData(roomData);

      await db
        .update(students)
        .set({ roomData: sanitizedData })
        .where(eq(students.id, studentId));

      res.json({
        success: true,
        message: "Room updated successfully"
      });

    } catch (error) {
      console.error("Error updating room:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to update room" 
      });
    }
  });

} 