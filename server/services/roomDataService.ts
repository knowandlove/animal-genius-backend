import { db } from "../db";
import { students, classes, purchaseRequests, storeSettings, storeItems, studentInventory, animalTypes, geniusTypes, itemTypes } from "@shared/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import * as cache from "../lib/cache";
import StorageRouter from "../services/storage-router";

// Cache management service for cleaner invalidation
class StudentCacheManager {
  private static instance: StudentCacheManager;
  
  static getInstance(): StudentCacheManager {
    if (!StudentCacheManager.instance) {
      StudentCacheManager.instance = new StudentCacheManager();
    }
    return StudentCacheManager.instance;
  }
  
  // Get all cache keys for a student
  private getStudentCacheKeys(passportCode: string, studentId?: string): string[] {
    const keys = [
      `room-page-data:${passportCode}`,
      `student-room:${passportCode}`,
    ];
    
    if (studentId) {
      keys.push(
        `student-inventory:${studentId}`,
        `student-purchases:${studentId}`
      );
    }
    
    return keys;
  }
  
  // Invalidate all caches for a student
  invalidateStudent(passportCode: string, studentId?: string): void {
    const keys = this.getStudentCacheKeys(passportCode, studentId);
    keys.forEach(key => cache.del(key));
    console.log(`🧹 Invalidated ${keys.length} cache keys for ${passportCode}`);
  }
  
  // Invalidate store catalog cache
  invalidateStoreCatalog(): void {
    cache.del('store-catalog:active');
    console.log('🧹 Invalidated store catalog cache');
  }
  
  // Invalidate class-specific caches
  invalidateClass(classId: string): void {
    cache.del(`store-status:${classId}`);
    console.log(`🧹 Invalidated class cache for ${classId}`);
  }
}

export const studentCache = StudentCacheManager.getInstance();

// Phase 1 Migration: Room aliases for gradual migration
export async function getRoomPageData(passportCode: string) {
  return RoomDataService.getStudentRoomData(passportCode);
}

// Optimized data fetching service
export class RoomDataService {
  // Fetch all student room data in a more efficient way
  static async getStudentRoomData(passportCode: string) {
    // Try to get from cache first
    const cacheKey = `room-page-data:${passportCode}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`✅ Cache hit for ${cacheKey}`);
      return cached;
    }
    
    console.log(`⚡ Cache miss for ${cacheKey}, fetching from DB`);
    
    // Use a single complex query to get most data at once
    const studentData = await db
      .select({
        // Student fields
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
        createdAt: students.createdAt,
        passportCode: students.passportCode,
        // Class fields
        className: classes.name,
        classId: classes.id,
        // Store settings (using subquery for efficiency)
        storeIsOpen: storeSettings.isOpen,
        storeOpenedAt: storeSettings.openedAt,
        storeClosesAt: storeSettings.closesAt,
      })
      .from(students)
      .innerJoin(classes, eq(students.classId, classes.id))
      .leftJoin(animalTypes, eq(students.animalTypeId, animalTypes.id))
      .leftJoin(geniusTypes, eq(students.geniusTypeId, geniusTypes.id))
      .leftJoin(storeSettings, eq(storeSettings.classId, classes.id))
      .where(eq(students.passportCode, passportCode))
      .limit(1);

    if (studentData.length === 0) {
      return null;
    }

    const student = studentData[0];
    
    // Determine store status
    const now = new Date();
    let isStoreOpen = student.storeIsOpen || false;
    let storeMessage = "Store is open! Happy shopping!";
    
    if (!student.storeIsOpen) {
      storeMessage = "Store is currently closed by your teacher.";
      isStoreOpen = false;
    } else if (student.storeClosesAt && new Date(student.storeClosesAt) < now) {
      isStoreOpen = false;
      storeMessage = "Store hours have ended for today.";
    } else if (student.storeOpenedAt && new Date(student.storeOpenedAt) > now) {
      isStoreOpen = false;
      storeMessage = "Store will open soon!";
    }
    
    // Parallel fetch remaining data
    const [storeCatalog, purchaseRequests, inventoryData] = await Promise.all([
      // Store catalog (only if open)
      isStoreOpen ? this.getStoreCatalog() : [],
      
      // Purchase requests
      db.select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.studentId, student.id))
        .orderBy(desc(purchaseRequests.requestedAt)),
      
      // Inventory with batch image URL processing
      this.getStudentInventory(student.id)
    ]);
    
    // Calculate wallet
    const pendingTotal = purchaseRequests
      .filter(req => req.status === 'pending')
      .reduce((sum, req) => sum + (req.cost || 0), 0);
    
    // Build response
    const pageData = {
      island: {
        id: student.id,
        passportCode: student.passportCode,
        studentName: student.studentName,
        gradeLevel: student.gradeLevel,
        animalType: student.animalTypeName || student.animalTypeCode || 'unknown',
        animalTypeCode: student.animalTypeCode,
        personalityType: student.personalityType,
        animalGenius: student.geniusTypeName || student.geniusTypeCode || 'unknown',
        geniusTypeCode: student.geniusTypeCode,
        learningStyle: student.learningStyle,
        currencyBalance: student.currencyBalance || 0,
        avatarData: {
          ...student.avatarData,
          equipped: inventoryData.equipped,
          owned: inventoryData.owned
        },
        roomData: student.roomData || { furniture: [] },
        className: student.className,
        classId: student.classId,
        createdAt: student.createdAt,
        inventoryItems: inventoryData.items
      },
      wallet: {
        total: student.currencyBalance || 0,
        pending: pendingTotal,
        available: (student.currencyBalance || 0) - pendingTotal
      },
      storeStatus: {
        isOpen: isStoreOpen,
        message: storeMessage,
        classId: student.classId,
        className: student.className,
        openedAt: student.storeOpenedAt,
        closesAt: student.storeClosesAt
      },
      storeCatalog,
      purchaseRequests
    };
    
    // Cache for 2 minutes (balances freshness with performance under load)
    cache.set(cacheKey, pageData, 120);
    console.log(`💾 Cached island data for ${cacheKey}`);
    
    return pageData;
  }
  
  // Get store catalog with efficient caching
  private static async getStoreCatalog() {
    const catalogCacheKey = 'store-catalog:active';
    const cached = cache.get<any[]>(catalogCacheKey);
    
    if (cached) {
      return cached;
    }
    
    const items = await db
      .select({
        id: storeItems.id,
        name: storeItems.name,
        description: storeItems.description,
        itemTypeCode: itemTypes.code,
        cost: storeItems.cost,
        rarity: storeItems.rarity,
        assetId: storeItems.assetId,
      })
      .from(storeItems)
      .innerJoin(itemTypes, eq(storeItems.itemTypeId, itemTypes.id))
      .where(eq(storeItems.isActive, true))
      .orderBy(asc(storeItems.sortOrder), asc(storeItems.name));
    
    // Batch process all image URLs at once
    const preparedItems = await StorageRouter.prepareStoreItemsResponse(items);
    
    const catalog = preparedItems.map((item: any) => ({
      id: item.id,
      name: item.name,
      type: item.itemTypeCode,
      cost: item.cost,
      description: item.description,
      rarity: item.rarity,
      imageUrl: item.imageUrl
    }));
    
    // Cache for 10 minutes
    cache.set(catalogCacheKey, catalog, 600);
    return catalog;
  }
  
  // Get student inventory with batch processing
  private static async getStudentInventory(studentId: string) {
    const inventoryData = await db
      .select({
        itemId: studentInventory.storeItemId,
        isEquipped: studentInventory.isEquipped,
        acquiredAt: studentInventory.acquiredAt,
        name: storeItems.name,
        description: storeItems.description,
        itemTypeCode: itemTypes.code,
        itemTypeCategory: itemTypes.category,
        cost: storeItems.cost,
        rarity: storeItems.rarity,
        assetId: storeItems.assetId
      })
      .from(studentInventory)
      .innerJoin(storeItems, eq(studentInventory.storeItemId, storeItems.id))
      .innerJoin(itemTypes, eq(storeItems.itemTypeId, itemTypes.id))
      .where(eq(studentInventory.studentId, studentId));
    
    // Batch process all image URLs at once
    const itemsWithAssets = inventoryData.filter(item => item.assetId);
    const preparedItems = itemsWithAssets.length > 0 
      ? await StorageRouter.prepareStoreItemsResponse(itemsWithAssets)
      : [];
    
    // Create a map for quick lookup
    const imageUrlMap = new Map(
      preparedItems.map((item: any) => [item.assetId, item.imageUrl])
    );
    
    // Transform inventory data
    const items = inventoryData.map(item => ({
      id: item.itemId,
      name: item.name,
      type: item.itemTypeCode,
      cost: item.cost,
      description: item.description,
      rarity: item.rarity,
      imageUrl: item.assetId ? imageUrlMap.get(item.assetId) || null : null,
      quantity: 1,
      obtainedAt: item.acquiredAt,
      isEquipped: item.isEquipped
    }));
    
    // Build equipped items map
    const equipped = inventoryData
      .filter(item => item.isEquipped)
      .reduce((acc, item) => {
        const slot = item.itemTypeCategory.replace('avatar_', '');
        acc[slot] = item.itemId;
        return acc;
      }, {} as Record<string, string>);
    
    return {
      items,
      equipped,
      owned: inventoryData.map(item => item.itemId)
    };
  }
}
