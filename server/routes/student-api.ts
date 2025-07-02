// Student API Routes - Uses passport code authentication system
import type { Express } from "express";
import { db } from "../db";
import { 
  students, 
  classes, 
  purchaseRequests, 
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
import * as cache from "../lib/cache";
import StorageRouter from "../services/storage-router";
import { authenticateToken } from "../middleware/auth";

// Student authentication schemas
const purchaseRequestSchema = z.object({
  itemId: z.string().uuid(),
});

const equipItemSchema = z.object({
  slot: z.string(),
  itemId: z.string().uuid().optional(),
});

const avatarUpdateSchema = z.object({
  avatarData: z.record(z.any()),
});

const roomUpdateSchema = z.object({
  roomData: z.record(z.any()),
});

export function registerStudentApiRoutes(app: Express) {
  
  // Get student dashboard/room data
  app.get("/api/student/dashboard", authenticateToken, async (req, res) => {
    try {
      const studentId = (req as any).studentId;

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
          passportCode: students.passportCode,
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

      // 4. Get purchase requests and calculate wallet
      const studentPurchaseRequests = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.studentId, student.id))
        .orderBy(desc(purchaseRequests.requestedAt));
      
      const pendingTotal = studentPurchaseRequests
        .filter(req => req.status === 'pending')
        .reduce((sum, req) => sum + (req.cost || 0), 0);
      
      const wallet = {
        total: student.currencyBalance || 0,
        pending: pendingTotal,
        available: (student.currencyBalance || 0) - pendingTotal
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

      // Return consolidated response
      res.json({
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
            passportCode: student.passportCode,
            className: student.className,
            classId: student.classId
          },
          store: storeStatus,
          catalog: storeCatalog,
          wallet: wallet,
          inventory: preparedInventory,
          purchaseRequests: studentPurchaseRequests
        }
      });

    } catch (error) {
      console.error("Error fetching student dashboard:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to load student dashboard" 
      });
    }
  });

  // Purchase item request
  app.post("/api/student/purchase", authenticateToken, async (req, res) => {
    try {
      const studentId = (req as any).studentId;
      const { itemId } = purchaseRequestSchema.parse(req.body);

      // Get student and item info
      const [student, item] = await Promise.all([
        db.select().from(students).where(eq(students.id, studentId)).limit(1),
        db.select().from(storeItems).where(eq(storeItems.id, itemId)).limit(1)
      ]);

      if (student.length === 0) {
        return res.status(404).json({ message: "Student not found" });
      }

      if (item.length === 0) {
        return res.status(404).json({ message: "Item not found" });
      }

      const studentData = student[0];
      const itemData = item[0];

      // Check if student has enough currency
      if ((studentData.currencyBalance || 0) < itemData.cost) {
        return res.status(400).json({ 
          message: "Insufficient currency",
          required: itemData.cost,
          available: studentData.currencyBalance || 0
        });
      }

      // Check if store is open (same logic as above)
      const classStoreSettings = await db
        .select()
        .from(storeSettings)
        .where(eq(storeSettings.classId, studentData.classId))
        .limit(1);

      if (classStoreSettings.length === 0 || !classStoreSettings[0].isOpen) {
        return res.status(400).json({ message: "Store is currently closed" });
      }

      // Create purchase request
      const [purchaseRequest] = await db
        .insert(purchaseRequests)
        .values({
          studentId: studentId,
          storeItemId: itemId,
          itemType: itemData.name, // Snapshot for audit
          cost: itemData.cost, // Snapshot for audit
          status: 'pending'
        })
        .returning();

      res.json({
        success: true,
        data: {
          purchaseRequest,
          message: "Purchase request submitted for teacher approval"
        }
      });

    } catch (error) {
      console.error("Error creating purchase request:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to create purchase request" 
      });
    }
  });

  // Update avatar data
  app.post("/api/student/avatar", authenticateToken, async (req, res) => {
    try {
      const studentId = (req as any).studentId;
      const { avatarData } = avatarUpdateSchema.parse(req.body);

      await db
        .update(students)
        .set({ avatarData })
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
  app.post("/api/student/room", authenticateToken, async (req, res) => {
    try {
      const studentId = (req as any).studentId;
      const { roomData } = roomUpdateSchema.parse(req.body);

      await db
        .update(students)
        .set({ roomData })
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