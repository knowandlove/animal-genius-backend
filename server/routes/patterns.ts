import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { patterns, storeItems, studentInventory, itemTypes, students } from '@shared/schema';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { requireStudentSession } from '../middleware/student-auth';
import { z } from 'zod';
import StorageRouter from '../services/storage-router';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

// Combined auth middleware that handles both student and teacher authentication
async function flexibleAuth(req: Request, res: Response, next: NextFunction) {
  console.log('FlexibleAuth - cookies:', req.cookies);
  console.log('FlexibleAuth - auth header:', req.headers.authorization);
  
  // First check for student cookie
  const studentCookie = req.cookies?.student_session;
  if (studentCookie) {
    try {
      if (!JWT_SECRET) {
        return res.status(500).json({ error: 'Server configuration error' });
      }
      const decoded = jwt.verify(studentCookie, JWT_SECRET) as any;
      (req as any).studentId = decoded.studentId;
      (req as any).authType = 'student';
      console.log('FlexibleAuth - authenticated as student:', decoded.studentId);
      return next();
    } catch (error) {
      console.log('FlexibleAuth - student cookie invalid:', error);
      // Cookie invalid, try other auth methods
    }
  }
  
  // Check if there's a Bearer token for teacher auth
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Try teacher auth
    requireAuth(req, res, (err) => {
      if (err) {
        console.log('FlexibleAuth - teacher auth failed');
        return res.status(401).json({ 
          success: false, 
          error: { message: 'Invalid authentication token' } 
        });
      }
      
      if ((req as any).user && (req as any).user.userId) {
        (req as any).authType = 'teacher';
        console.log('FlexibleAuth - authenticated as teacher:', (req as any).user.userId);
        return next();
      }
      
      // Should not reach here
      return res.status(401).json({ 
        success: false, 
        error: { message: 'Authentication failed' } 
      });
    });
  } else {
    // No valid authentication found
    console.log('FlexibleAuth - no valid auth found');
    return res.status(401).json({ 
      success: false, 
      error: { message: 'Authentication required - please provide student cookie or teacher token' } 
    });
  }
}

const router = Router();

// Validation schemas
const getSurfaceTypeSchema = z.object({
  surface_type: z.enum(['background', 'overlay', 'texture']).optional(),
});

/**
 * GET /api/student/inventory/patterns
 * Get owned patterns for a student (filtered by surface type)
 * Requires student authentication OR teacher authentication with student passport code
 */
router.get('/student/inventory/patterns', flexibleAuth, async (req, res) => {
  try {
    let studentId: string | undefined;
    
    if ((req as any).authType === 'teacher') {
      // Teacher is authenticated - get student ID from query params
      const passportCode = req.query.passportCode as string;
      if (!passportCode) {
        return res.status(400).json({ 
          success: false,
          error: { message: 'Passport code required for teacher access' }
        });
      }
      
      // Look up student by passport code
      const student = await db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.passportCode, passportCode))
        .limit(1);
        
      if (student.length === 0) {
        return res.status(404).json({ 
          success: false,
          error: { message: 'Student not found' }
        });
      }
      
      studentId = student[0].id;
    } else if ((req as any).authType === 'student') {
      // Student is authenticated via cookie
      studentId = (req as any).studentId;
    }
    
    if (!studentId) {
      return res.status(400).json({ 
        success: false,
        error: { message: 'Unable to determine student ID' }
      });
    }
    
    // Validate query parameters
    const query = getSurfaceTypeSchema.parse(req.query);
    const { surface_type } = query;
    
    console.log(`Fetching patterns for student ${studentId}, surface_type: ${surface_type || 'all'}`);
    
    // Build the query to get owned patterns
    let queryBuilder = db
      .select({
        id: patterns.id,
        code: patterns.code,
        name: patterns.name,
        description: patterns.description,
        surfaceType: patterns.surfaceType,
        patternType: patterns.patternType,
        patternValue: patterns.patternValue,
        theme: patterns.theme,
        thumbnailUrl: patterns.thumbnailUrl,
        isActive: patterns.isActive,
        itemId: storeItems.id,
        itemName: storeItems.name,
        itemDescription: storeItems.description,
        cost: storeItems.cost,
        rarity: storeItems.rarity,
        assetId: storeItems.assetId,
        assetType: storeItems.assetType,
        acquiredAt: studentInventory.acquiredAt,
        isEquipped: studentInventory.isEquipped,
      })
      .from(studentInventory)
      .innerJoin(storeItems, eq(studentInventory.storeItemId, storeItems.id))
      .innerJoin(patterns, eq(storeItems.patternId, patterns.id))
      .where(
        and(
          eq(studentInventory.studentId, studentId),
          isNotNull(storeItems.patternId)
        )
      );
    
    // Add surface type filter if provided
    if (surface_type) {
      queryBuilder = queryBuilder.where(
        and(
          eq(studentInventory.studentId, studentId),
          isNotNull(storeItems.patternId),
          eq(patterns.surfaceType, surface_type)
        )
      );
    }
    
    const ownedPatterns = await queryBuilder;
    
    console.log(`Found ${ownedPatterns.length} owned patterns`);
    
    // Prepare response with proper URLs using StorageRouter - batch process
    const storeItemDataList = ownedPatterns.map(pattern => ({
      id: pattern.itemId,
      name: pattern.itemName,
      description: pattern.itemDescription,
      cost: pattern.cost,
      rarity: pattern.rarity,
      assetId: pattern.assetId,
      assetType: pattern.assetType,
    }));
    
    // Batch prepare all items at once
    const preparedItems = await StorageRouter.prepareStoreItemsResponse(storeItemDataList);
    const preparedItemsMap = new Map(preparedItems.map(item => [item.id, item]));
    
    const preparedPatterns = ownedPatterns.map(pattern => {
      const preparedItem = preparedItemsMap.get(pattern.itemId);
      
      return {
        pattern: {
          id: pattern.id,
          code: pattern.code,
          name: pattern.name,
          description: pattern.description,
          surfaceType: pattern.surfaceType,
          patternType: pattern.patternType,
          patternValue: pattern.patternValue,
          theme: pattern.theme,
          thumbnailUrl: pattern.thumbnailUrl,
          isActive: pattern.isActive,
        },
        item: {
          id: pattern.itemId,
          name: pattern.itemName,
          description: pattern.itemDescription,
          cost: pattern.cost,
          rarity: pattern.rarity,
          imageUrl: preparedItem?.imageUrl,
          riveUrl: preparedItem?.riveUrl,
          assetType: pattern.assetType,
        },
        ownership: {
          acquiredAt: pattern.acquiredAt,
          isEquipped: pattern.isEquipped,
        },
      };
    });
    
    res.json({
      success: true,
      data: preparedPatterns,
    });
    
  } catch (error) {
    console.error('Error fetching student patterns:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false,
        error: { 
          message: "Invalid request parameters",
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }
      });
    }
    res.status(500).json({ 
      success: false,
      error: { message: 'Failed to fetch patterns' }
    });
  }
});

/**
 * GET /api/patterns/available
 * Get all available patterns for store display
 * Public endpoint - no authentication required
 */
router.get('/available', async (req, res) => {
  try {
    // Validate query parameters
    const query = getSurfaceTypeSchema.parse(req.query);
    const { surface_type } = query;
    
    console.log(`Fetching available patterns, surface_type: ${surface_type || 'all'}`);
    
    // Build query for available patterns with their store items
    let queryBuilder = db
      .select({
        id: patterns.id,
        code: patterns.code,
        name: patterns.name,
        description: patterns.description,
        surfaceType: patterns.surfaceType,
        patternType: patterns.patternType,
        patternValue: patterns.patternValue,
        theme: patterns.theme,
        thumbnailUrl: patterns.thumbnailUrl,
        isActive: patterns.isActive,
        itemId: storeItems.id,
        itemName: storeItems.name,
        itemDescription: storeItems.description,
        itemTypeId: storeItems.itemTypeId,
        itemTypeCode: itemTypes.code,
        itemTypeCategory: itemTypes.category,
        cost: storeItems.cost,
        rarity: storeItems.rarity,
        assetId: storeItems.assetId,
        assetType: storeItems.assetType,
        sortOrder: storeItems.sortOrder,
      })
      .from(patterns)
      .innerJoin(storeItems, eq(patterns.id, storeItems.patternId))
      .innerJoin(itemTypes, eq(storeItems.itemTypeId, itemTypes.id))
      .where(
        and(
          eq(patterns.isActive, true),
          eq(storeItems.isActive, true)
        )
      );
    
    // Add surface type filter if provided
    if (surface_type) {
      queryBuilder = queryBuilder.where(
        and(
          eq(patterns.isActive, true),
          eq(storeItems.isActive, true),
          eq(patterns.surfaceType, surface_type)
        )
      );
    }
    
    // Order by sort order and name
    queryBuilder = queryBuilder.orderBy(storeItems.sortOrder, storeItems.name);
    
    const availablePatterns = await queryBuilder;
    
    console.log(`Found ${availablePatterns.length} available patterns`);
    
    // Prepare response with proper URLs using StorageRouter - batch process
    const storeItemDataList = availablePatterns.map(pattern => ({
      id: pattern.itemId,
      name: pattern.itemName,
      description: pattern.itemDescription,
      itemTypeId: pattern.itemTypeId,
      itemTypeCode: pattern.itemTypeCode,
      itemTypeCategory: pattern.itemTypeCategory,
      cost: pattern.cost,
      rarity: pattern.rarity,
      assetId: pattern.assetId,
      assetType: pattern.assetType,
    }));
    
    // Batch prepare all items at once
    const preparedItems = await StorageRouter.prepareStoreItemsResponse(storeItemDataList);
    const preparedItemsMap = new Map(preparedItems.map(item => [item.id, item]));
    
    const preparedPatterns = availablePatterns.map(pattern => {
      const preparedItem = preparedItemsMap.get(pattern.itemId);
      
      return {
        pattern: {
          id: pattern.id,
          code: pattern.code,
          name: pattern.name,
          description: pattern.description,
          surfaceType: pattern.surfaceType,
          patternType: pattern.patternType,
          patternValue: pattern.patternValue,
          theme: pattern.theme,
          thumbnailUrl: pattern.thumbnailUrl,
          isActive: pattern.isActive,
        },
        item: {
          id: pattern.itemId,
          name: pattern.itemName,
          description: pattern.itemDescription,
          type: pattern.itemTypeCode,
          category: pattern.itemTypeCategory,
          cost: pattern.cost,
          rarity: pattern.rarity,
          imageUrl: preparedItem?.imageUrl,
          riveUrl: preparedItem?.riveUrl,
          assetType: pattern.assetType,
          sortOrder: pattern.sortOrder,
        },
      };
    });
    
    res.json({
      success: true,
      data: preparedPatterns,
    });
    
  } catch (error) {
    console.error('Error fetching available patterns:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false,
        error: { 
          message: "Invalid request parameters",
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }
      });
    }
    res.status(500).json({ 
      success: false,
      error: { message: 'Failed to fetch available patterns' }
    });
  }
});

/**
 * GET /api/patterns/:patternId/ownership
 * Check if a student owns a specific pattern
 * Requires student authentication
 */
router.get('/:patternId/ownership', requireStudentSession, async (req, res) => {
  try {
    const studentId = req.studentId;
    const { patternId } = req.params;
    
    // Validate pattern ID
    const patternIdSchema = z.string().uuid();
    const validatedPatternId = patternIdSchema.parse(patternId);
    
    console.log(`Checking pattern ownership for student ${studentId}, pattern ${validatedPatternId}`);
    
    // Check if student owns this pattern
    const ownership = await db
      .select({
        inventoryId: studentInventory.id,
        acquiredAt: studentInventory.acquiredAt,
        isEquipped: studentInventory.isEquipped,
        patternId: patterns.id,
        patternCode: patterns.code,
        patternName: patterns.name,
      })
      .from(studentInventory)
      .innerJoin(storeItems, eq(studentInventory.storeItemId, storeItems.id))
      .innerJoin(patterns, eq(storeItems.patternId, patterns.id))
      .where(
        and(
          eq(studentInventory.studentId, studentId),
          eq(patterns.id, validatedPatternId)
        )
      )
      .limit(1);
    
    if (ownership.length === 0) {
      return res.json({
        success: true,
        data: {
          owned: false,
          pattern: {
            id: validatedPatternId,
          },
        },
      });
    }
    
    const [ownershipData] = ownership;
    
    res.json({
      success: true,
      data: {
        owned: true,
        pattern: {
          id: ownershipData.patternId,
          code: ownershipData.patternCode,
          name: ownershipData.patternName,
        },
        ownership: {
          inventoryId: ownershipData.inventoryId,
          acquiredAt: ownershipData.acquiredAt,
          isEquipped: ownershipData.isEquipped,
        },
      },
    });
    
  } catch (error) {
    console.error('Error checking pattern ownership:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false,
        error: { 
          message: "Invalid pattern ID",
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }
      });
    }
    res.status(500).json({ 
      success: false,
      error: { message: 'Failed to check pattern ownership' }
    });
  }
});

export default router;