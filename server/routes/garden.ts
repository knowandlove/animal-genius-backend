import { Router } from 'express';
import { z } from 'zod';
import { requireStudentAuth, optionalStudentAuth } from '../middleware/passport-auth.js';
import { validateBody } from '../middleware/validation.js';
import { gardenService } from '../services/gardenService.js';
import { asyncWrapper } from '../utils/async-wrapper.js';
import { checkFeatureFlag } from '../middleware/feature-flags.js';
import { db } from '../db.js';
import { students, studentInventory, storeItems, itemTypes, classes, animalTypes, geniusTypes } from '../../shared/schema.js';
import { seedTypes, gardenPlots } from '../../shared/schema-gardens.js';
import { eq, and } from 'drizzle-orm';

export const router = Router();

// Check if garden system is enabled
// router.use(checkFeatureFlag('garden_system')); // Temporarily disabled for testing

// Get student info and garden plot by passport code
router.get('/student/:passportCode',
  optionalStudentAuth,
  asyncWrapper(async (req, res) => {
    const { passportCode } = req.params;
    const currentStudent = req.student;
    
    // Get the target student
    const [targetStudent] = await db
      .select({
        id: students.id,
        passportCode: students.passportCode,
        studentName: students.studentName,
        animalTypeId: students.animalTypeId,
        geniusTypeId: students.geniusTypeId,
        currencyBalance: students.currencyBalance,
        classId: students.classId
      })
      .from(students)
      .where(eq(students.passportCode, passportCode))
      .limit(1);
      
    if (!targetStudent) {
      res.status(404).json({
        success: false,
        error: 'Student not found'
      });
      return;
    }
    
    // Get class info
    const [classInfo] = await db
      .select({
        id: classes.id,
        className: classes.name,
        classCode: classes.classCode
      })
      .from(classes)
      .where(eq(classes.id, targetStudent.classId))
      .limit(1);
    
    // Check if the viewer can see this garden
    const canView = !currentStudent || currentStudent.classId === targetStudent.classId;
    if (!canView) {
      res.status(403).json({
        success: false,
        error: 'You can only view gardens from your class'
      });
      return;
    }
    
    // Get the garden plot
    const [plot] = await db
      .select()
      .from(gardenPlots)
      .where(eq(gardenPlots.studentId, targetStudent.id))
      .limit(1);
      
    let gardenData = null;
    if (plot) {
      gardenData = await gardenService.getGardenView(plot.id);
    }
    
    // Get animal type name
    const [animalType] = await db
      .select({ name: animalTypes.name })
      .from(animalTypes)
      .where(eq(animalTypes.id, targetStudent.animalTypeId))
      .limit(1);
      
    // Get genius type name
    const [geniusType] = await db
      .select({ name: geniusTypes.name })
      .from(geniusTypes)
      .where(eq(geniusTypes.id, targetStudent.geniusTypeId))
      .limit(1);
    
    res.json({
      success: true,
      student: {
        ...targetStudent,
        animalType: animalType?.name || 'Unknown',
        geniusType: geniusType?.name || 'Unknown',
        className: classInfo?.className || 'Unknown Class',
        classCode: classInfo?.classCode
      },
      garden: gardenData,
      canEdit: currentStudent?.passportCode === passportCode
    });
  })
);

// Get student's garden plot
router.get('/plot/:passportCode', 
  optionalStudentAuth,
  asyncWrapper(async (req, res) => {
    const { passportCode } = req.params;
    const currentStudent = req.student; // May be null if not authenticated
    
    // Get the target student from passport code
    const [targetStudent] = await db
      .select({
        id: students.id,
        classId: students.classId,
        passportCode: students.passportCode
      })
      .from(students)
      .where(eq(students.passportCode, passportCode))
      .limit(1);
      
    if (!targetStudent) {
      res.status(404).json({
        success: false,
        error: 'Garden not found'
      });
      return;
    }
    
    // For viewing other students' gardens, they must be in the same class
    if (currentStudent && currentStudent.classId !== targetStudent.classId) {
      res.status(403).json({
        success: false,
        error: 'You can only view gardens from your class'
      });
      return;
    }
    
    // Get or create plot (only create if viewing own garden)
    let plot;
    const isOwnGarden = currentStudent && currentStudent.passportCode === passportCode;
    
    if (isOwnGarden) {
      plot = await gardenService.getOrCreatePlot(targetStudent.id, targetStudent.classId);
    } else {
      // Just get the plot, don't create
      const [existingPlot] = await db
        .select()
        .from(gardenPlots)
        .where(eq(gardenPlots.studentId, targetStudent.id))
        .limit(1);
        
      if (!existingPlot) {
        res.status(404).json({
          success: false,
          error: 'This student has not created a garden yet'
        });
        return;
      }
      plot = existingPlot;
    }
    
    // Get full garden view
    const gardenView = await gardenService.getGardenView(plot.id);
    
    res.json({
      success: true,
      data: gardenView
    });
  })
);

// Plant a seed
const plantSchema = z.object({
  plotId: z.string().uuid(),
  seedType: z.string(),
  positionX: z.number().int().min(0).max(9),
  positionY: z.number().int().min(0).max(9)
});

router.post('/plant',
  requireStudentAuth,
  validateBody(plantSchema),
  asyncWrapper(async (req, res) => {
    const student = req.student!;
    const { plotId, seedType, positionX, positionY } = req.body;
    
    const planted = await gardenService.plantSeed(
      student.id,
      plotId,
      seedType,
      positionX,
      positionY
    );
    
    res.json({
      success: true,
      data: {
        planted,
        message: 'Seed planted successfully!'
      }
    });
  })
);

// Water the class garden (class-wide boost)
const waterSchema = z.object({
  classId: z.string().uuid()
});

router.post('/water',
  requireStudentAuth,
  validateBody(waterSchema),
  asyncWrapper(async (req, res) => {
    const student = req.student!;
    const { classId } = req.body;
    
    // Verify student is in this class
    if (student.classId !== classId) {
      res.status(403).json({
        success: false,
        error: 'You can only water your own class garden'
      });
      return;
    }
    
    const result = await gardenService.waterClassGarden(classId, student.id);
    
    res.json({
      success: true,
      data: {
        ...result,
        message: `Watered ${result.plantsWatered} plants! Growth boost active until ${result.boostUntil.toLocaleString()}`
      }
    });
  })
);

// Harvest a crop
const harvestSchema = z.object({
  cropId: z.string().uuid()
});

router.post('/harvest',
  requireStudentAuth,
  validateBody(harvestSchema),
  asyncWrapper(async (req, res) => {
    const student = req.student!;
    const { cropId } = req.body;
    
    const result = await gardenService.harvestCrop(student.id, cropId);
    
    res.json({
      success: true,
      data: {
        ...result,
        message: `Harvested ${result.seedType} for ${result.coinsEarned} coins!`
      }
    });
  })
);

// Get class garden overview for a specific class
router.get('/class/:classId',
  optionalStudentAuth,
  asyncWrapper(async (req, res) => {
    const { classId } = req.params;
    
    // This would show all plots in the class
    // For now, return basic info
    res.json({
      success: true,
      data: {
        message: 'Class garden view coming soon',
        classId
      }
    });
  })
);

// Get class garden for authenticated student
router.get('/class',
  requireStudentAuth,
  asyncWrapper(async (req, res) => {
    const student = req.student!;
    
    try {
      const classGarden = await gardenService.getClassGarden(student.classId);
      
      res.json({
        classId: classGarden.classId,
        className: classGarden.className,
        students: classGarden.students,
        currentStudent: student.passportCode,
        stats: classGarden.stats,
        lastWatered: classGarden.lastWatered
      });
    } catch (error) {
      console.error('getClassGarden error:', error);
      throw error;
    }
  })
);

// Get available seeds from inventory
router.get('/available-seeds',
  requireStudentAuth,
  asyncWrapper(async (req, res) => {
    const student = req.student!;
    
    const seeds = await db
      .select({
        inventoryId: studentInventory.id,
        storeItemId: studentInventory.storeItemId,
        quantity: studentInventory.quantity,
        itemName: storeItems.name,
        itemType: itemTypes.code,
        thumbnailUrl: storeItems.thumbnailUrl
      })
      .from(studentInventory)
      .innerJoin(storeItems, eq(studentInventory.storeItemId, storeItems.id))
      .innerJoin(itemTypes, eq(storeItems.itemTypeId, itemTypes.id))
      .where(and(
        eq(studentInventory.studentId, student.id),
        eq(itemTypes.code, 'seeds')
      ));
      
    // Transform to include seed type info
    const seedsWithInfo = await Promise.all(seeds.map(async (item) => {
      const seedName = item.itemName.replace(' Seeds', '').toLowerCase();
      const [seedType] = await db
        .select()
        .from(seedTypes)
        .where(eq(seedTypes.name, item.itemName.replace(' Seeds', '')))
        .limit(1);
        
      return {
        inventoryId: item.inventoryId,
        storeItemId: item.storeItemId,
        seedType: seedType?.id || seedName,
        name: item.itemName,
        emoji: item.thumbnailUrl,
        growthHours: seedType?.baseGrowthHours || 24,
        quantity: item.quantity
      };
    }));
    
    res.json({ seeds: seedsWithInfo });
  })
);

export default router;