// Direct Store Purchase Routes (No Approval Required)
import { Router } from 'express';
import { db } from '../db';
import { students, storeItems, studentInventory, currencyTransactions, classes } from '@shared/schema';
import { eq, and, sql, asc } from 'drizzle-orm';
import { z } from 'zod';
import StorageRouter from '../services/storage-router';
import { storePurchaseLimiter, storeBrowsingLimiter } from '../middleware/rateLimiter';
import { requireStudentSession } from '../middleware/student-auth';
import { validateOwnDataAccess } from '../middleware/validate-student-class';

const router = Router();

// Simple in-memory cache for store catalog (shared with store.ts)
interface CatalogCache {
  data: any[];
  timestamp: number;
}

let catalogCache: CatalogCache | null = null;
const CATALOG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

// Validation schemas
const purchaseSchema = z.object({
  passportCode: z.string().min(6).max(20),
  itemId: z.string().uuid()
});

// Helper to validate passport code format
function isValidPassportCode(code: string): boolean {
  return /^[A-Z]{3}-[A-Z0-9]{3}$/.test(code);
}

/**
 * GET /api/store-direct/catalog
 * Get all active store items (with caching)
 */
router.get('/catalog', storeBrowsingLimiter, async (req, res) => {
  try {
    // Check cache first
    const now = Date.now();
    if (catalogCache && (now - catalogCache.timestamp) < CATALOG_CACHE_TTL) {
      return res.json(catalogCache.data);
    }
    
    const items = await db
      .select()
      .from(storeItems)
      .where(eq(storeItems.isActive, true))
      .orderBy(asc(storeItems.sortOrder), asc(storeItems.name));
    
    // Prepare items with proper image URLs
    const preparedItems = await StorageRouter.prepareStoreItemsResponse(items);
    
    // Cache the result
    catalogCache = {
      data: preparedItems,
      timestamp: now
    };
    
    res.json(preparedItems);
  } catch (error) {
    console.error('Error fetching store catalog:', error);
    res.status(500).json({ error: 'Failed to fetch store catalog' });
  }
});

/**
 * POST /api/store-direct/purchase
 * Direct purchase - coins are deducted immediately
 * REQUIRES AUTHENTICATION - students can only purchase for themselves
 */
router.post('/purchase', requireStudentSession, validateOwnDataAccess, storePurchaseLimiter, async (req, res) => {
  const purchaseStartTime = Date.now();
  const clientIP = req.ip || req.connection.remoteAddress;
  
  try {
    const { passportCode, itemId } = purchaseSchema.parse(req.body);
    
    console.log(`[PURCHASE ATTEMPT] ${new Date().toISOString()} - Student: ${passportCode}, Item: ${itemId}, IP: ${clientIP}`);
    
    // Validate passport code format
    if (!isValidPassportCode(passportCode)) {
      console.log(`[PURCHASE FAILED] Invalid passport code format: ${passportCode}`);
      return res.status(400).json({ message: 'Invalid passport code format' });
    }
    
    // Execute purchase in a single transaction
    const result = await db.transaction(async (tx) => {
      // Get student data
      const [student] = await tx
        .select({
          id: students.id,
          studentName: students.studentName,
          currencyBalance: students.currencyBalance,
          classId: students.classId
        })
        .from(students)
        .where(eq(students.passportCode, passportCode))
        .limit(1);
      
      if (!student) {
        throw new Error('Student not found');
      }
      
      // Get item details
      const [item] = await tx
        .select()
        .from(storeItems)
        .where(and(
          eq(storeItems.id, itemId),
          eq(storeItems.isActive, true)
        ))
        .limit(1);
      
      if (!item) {
        throw new Error('Item not found or not available');
      }
      
      // Check if student already owns this item
      const [existingOwnership] = await tx
        .select()
        .from(studentInventory)
        .where(and(
          eq(studentInventory.studentId, student.id),
          eq(studentInventory.storeItemId, itemId)
        ))
        .limit(1);
      
      if (existingOwnership) {
        throw new Error('You already own this item');
      }
      
      // Check balance
      if (student.currencyBalance < item.cost) {
        throw new Error(`Insufficient funds. You have ${student.currencyBalance} coins but need ${item.cost}`);
      }
      
      // Get teacher ID for the transaction record
      const [classInfo] = await tx
        .select({ teacherId: classes.teacherId })
        .from(classes)
        .where(eq(classes.id, student.classId))
        .limit(1);
      
      if (!classInfo) {
        throw new Error('Class configuration error');
      }
      
      // Update student balance with atomic check to prevent negative balance
      const [updatedStudent] = await tx
        .update(students)
        .set({
          currencyBalance: sql`${students.currencyBalance} - ${item.cost}`,
          updatedAt: new Date()
        })
        .where(and(
          eq(students.id, student.id),
          sql`${students.currencyBalance} - ${item.cost} >= 0` // Atomic balance check
        ))
        .returning({ currencyBalance: students.currencyBalance });
      
      if (!updatedStudent) {
        throw new Error(`Insufficient funds. Transaction failed.`);
      }
      
      // Add item to inventory
      await tx
        .insert(studentInventory)
        .values({
          studentId: student.id,
          storeItemId: itemId,
          isEquipped: false
        });
      
      // Create currency transaction record
      await tx
        .insert(currencyTransactions)
        .values({
          studentId: student.id,
          teacherId: classInfo.teacherId,
          amount: -item.cost, // Negative for purchases
          transactionType: 'purchase',
          description: `Purchase: ${item.name}`
        });
      
      // Note: We don't create purchase_requests records in direct purchase mode
      // This is a simplified flow where coins are deducted immediately
      
      return {
        success: true,
        item: {
          id: item.id,
          name: item.name,
          itemType: item.itemTypeId,
          cost: item.cost
        },
        newBalance: updatedStudent.currencyBalance
      };
    });
    
    const purchaseEndTime = Date.now();
    console.log(`[PURCHASE SUCCESS] ${passportCode} bought ${result.item.name} for ${result.item.cost} coins in ${purchaseEndTime - purchaseStartTime}ms`);
    
    res.json(result);
  } catch (error) {
    const purchaseEndTime = Date.now();
    console.error(`[PURCHASE ERROR] ${req.body.passportCode || 'unknown'} - ${error instanceof Error ? error.message : 'Unknown error'} in ${purchaseEndTime - purchaseStartTime}ms`);
    const message = error instanceof Error ? error.message : 'Failed to complete purchase';
    res.status(400).json({ message });
  }
});

/**
 * GET /api/store-direct/inventory/:passportCode
 * Get student's owned items
 */
router.get('/inventory/:passportCode', storeBrowsingLimiter, async (req, res) => {
  try {
    const { passportCode } = req.params;
    
    if (!isValidPassportCode(passportCode)) {
      return res.status(400).json({ message: 'Invalid passport code format' });
    }
    
    // Get student
    const [student] = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.passportCode, passportCode))
      .limit(1);
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    // Get owned items with details
    const ownedItems = await db
      .select({
        inventoryId: studentInventory.id,
        itemId: storeItems.id,
        name: storeItems.name,
        itemType: storeItems.itemTypeId,
        description: storeItems.description,
        rarity: storeItems.rarity,
        isEquipped: studentInventory.isEquipped,
        acquiredAt: studentInventory.acquiredAt
      })
      .from(studentInventory)
      .innerJoin(storeItems, eq(studentInventory.storeItemId, storeItems.id))
      .where(eq(studentInventory.studentId, student.id))
      .orderBy(asc(studentInventory.acquiredAt));
    
    // Prepare items with image URLs
    const preparedItems = await StorageRouter.prepareStoreItemsResponse(
      ownedItems.map(item => ({
        ...item,
        id: item.itemId,
        cost: 0, // Not needed for inventory
        isActive: true,
        sortOrder: 0,
        assetId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }))
    );
    
    // Map back to inventory format
    const inventory = preparedItems.map((item, index) => ({
      ...ownedItems[index],
      imageUrl: item.imageUrl
    }));
    
    res.json(inventory);
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ message: 'Failed to get inventory' });
  }
});

export default router;