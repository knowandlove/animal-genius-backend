import { db } from '../db.js';
import { 
  students,
  studentInventory,
  currencyTransactions,
  storeItems,
  classes,
  animalTypes,
  geniusTypes
} from '../../shared/schema.js';
import { 
  gardenPlots, 
  plantedCrops, 
  classGardens,
  seedTypes,
  harvestLogs,
  type GardenPlot,
  type PlantedCrop,
  type SeedType
} from '../../shared/schema-gardens.js';
import { eq, and, sql, lt, inArray, desc } from 'drizzle-orm';
import { getCache } from '../lib/cache-factory.js';
import { ConflictError, ValidationError, NotFoundError, AuthorizationError, RateLimitError } from '../utils/errors.js';

// Constants
const WATER_BOOST_MULTIPLIER = 2;
const WATER_BOOST_DURATION_HOURS = 24;
const CLASS_WATER_COOLDOWN_MINUTES = 30;
const MAX_GRID_SIZE = 10; // Future-proof for expansion

export class GardenService {
  /**
   * Initialize seed types if they don't exist
   */
  async initializeSeedTypes() {
    try {
      const seedData = [
        { id: 'tomato', name: 'Tomato', category: 'vegetable', baseGrowthHours: 24, baseSellPrice: 20, purchasePrice: 10, iconEmoji: '🍅', rarity: 'common' },
        { id: 'lettuce', name: 'Lettuce', category: 'vegetable', baseGrowthHours: 24, baseSellPrice: 18, purchasePrice: 8, iconEmoji: '🥬', rarity: 'common' },
        { id: 'strawberry', name: 'Strawberry', category: 'fruit', baseGrowthHours: 48, baseSellPrice: 40, purchasePrice: 18, iconEmoji: '🍓', rarity: 'common' },
      ];
      
      for (const seed of seedData) {
        await db.insert(seedTypes)
          .values(seed)
          .onConflictDoNothing();
      }
    } catch (error) {
      console.error('Error initializing seed types:', error);
    }
  }
  /**
   * Get or create a garden plot for a student
   */
  async getOrCreatePlot(studentId: string, classId: string): Promise<GardenPlot> {
    // Check cache first
    const cache = getCache();
    const cacheKey = `garden-plot:${studentId}`;
    const cached = await cache.get<GardenPlot>(cacheKey);
    if (cached) return cached;

    // Try to get existing plot
    const existingPlot = await db
      .select()
      .from(gardenPlots)
      .where(eq(gardenPlots.studentId, studentId))
      .limit(1);

    if (existingPlot.length > 0) {
      await cache.set(cacheKey, existingPlot[0], 300); // Cache for 5 minutes
      return existingPlot[0];
    }

    // Create new plot with next available position
    const position = await this.getNextPlotPosition(classId);
    
    const [newPlot] = await db
      .insert(gardenPlots)
      .values({
        studentId,
        classId,
        plotPosition: position,
        gardenTheme: 'meadow'
      })
      .returning();

    // Initialize class garden if needed
    await this.ensureClassGarden(classId);

    await cache.set(cacheKey, newPlot, 300);
    return newPlot;
  }

  /**
   * Get the next available plot position in a class
   */
  private async getNextPlotPosition(classId: string): Promise<number> {
    const result = await db
      .select({ maxPosition: sql<number>`MAX(plot_position)` })
      .from(gardenPlots)
      .where(eq(gardenPlots.classId, classId));

    const maxPosition = result[0]?.maxPosition ?? -1;
    return maxPosition + 1;
  }

  /**
   * Ensure class garden exists
   */
  private async ensureClassGarden(classId: string): Promise<void> {
    await db
      .insert(classGardens)
      .values({ classId })
      .onConflictDoNothing();
  }

  /**
   * Plant a seed in the garden
   */
  async plantSeed(
    studentId: string,
    plotId: string,
    seedType: string,
    positionX: number,
    positionY: number
  ): Promise<PlantedCrop> {
    // Validate plot ownership
    const plot = await db
      .select()
      .from(gardenPlots)
      .where(and(
        eq(gardenPlots.id, plotId),
        eq(gardenPlots.studentId, studentId)
      ))
      .limit(1);

    if (plot.length === 0) {
      throw new AuthorizationError('This is not your garden plot');
    }

    // Validate position
    if (positionX < 0 || positionX >= MAX_GRID_SIZE || 
        positionY < 0 || positionY >= MAX_GRID_SIZE) {
      throw new ValidationError('Invalid planting position');
    }

    // Get seed info
    const [seed] = await db
      .select()
      .from(seedTypes)
      .where(eq(seedTypes.id, seedType))
      .limit(1);

    if (!seed) {
      throw new NotFoundError('Seed type');
    }

    // Check inventory for seeds
    const inventory = await db
      .select()
      .from(studentInventory)
      .innerJoin(storeItems, eq(studentInventory.storeItemId, storeItems.id))
      .where(and(
        eq(studentInventory.studentId, studentId),
        eq(storeItems.name, `${seed.name} Seeds`)
      ))
      .limit(1);

    if (inventory.length === 0) {
      throw new ValidationError('You don\'t have any of these seeds');
    }

    // Start transaction
    const result = await db.transaction(async (tx) => {
      // Check if position is already occupied
      const existing = await tx
        .select()
        .from(plantedCrops)
        .where(and(
          eq(plantedCrops.plotId, plotId),
          eq(plantedCrops.positionX, positionX),
          eq(plantedCrops.positionY, positionY),
          eq(plantedCrops.isHarvested, false)
        ))
        .limit(1);

      if (existing.length > 0) {
        throw new ConflictError('This position already has a plant');
      }

      // Calculate harvest time
      const harvestReadyAt = new Date(
        Date.now() + seed.baseGrowthHours * 60 * 60 * 1000
      );

      // Plant the seed
      const [planted] = await tx
        .insert(plantedCrops)
        .values({
          plotId,
          seedType: seed.id,
          positionX,
          positionY,
          harvestReadyAt,
          growthStage: 0
        })
        .returning();

      // Remove seed from inventory
      await tx
        .delete(studentInventory)
        .where(eq(studentInventory.id, inventory[0].student_inventory.id));

      return planted;
    });

    // Invalidate cache
    await this.invalidateStudentCache(studentId);

    return result;
  }

  /**
   * Water all plants in the class (class-wide boost)
   */
  async waterClassGarden(classId: string, initiatorId: string): Promise<{
    plantsWatered: number;
    boostUntil: Date;
  }> {
    try {
      // Check cooldown
      const [classGarden] = await db
        .select()
        .from(classGardens)
        .where(eq(classGardens.classId, classId))
        .limit(1);

    if (classGarden?.lastWateredAt) {
      const cooldownEnd = new Date(
        classGarden.lastWateredAt.getTime() + CLASS_WATER_COOLDOWN_MINUTES * 60 * 1000
      );
      if (cooldownEnd > new Date()) {
        const minutesLeft = Math.ceil((cooldownEnd.getTime() - Date.now()) / 60000);
        throw new RateLimitError(
          `Class garden was recently watered. Try again in ${minutesLeft} minutes`
        );
      }
    }

    const now = new Date();
    const boostUntil = new Date(now.getTime() + WATER_BOOST_DURATION_HOURS * 60 * 60 * 1000);

    // Update all unharvested crops in the class
    const result = await db.transaction(async (tx) => {
      // Get all plots in the class
      const plots = await tx
        .select({ id: gardenPlots.id })
        .from(gardenPlots)
        .where(eq(gardenPlots.classId, classId));

      const plotIds = plots.map(p => p.id);

      // Update all unharvested crops
      let plantsWatered = 0;
      if (plotIds.length > 0) {
        // Update each plot's crops individually to avoid SQL array issues
        for (const plotId of plotIds) {
          const result = await tx
            .update(plantedCrops)
            .set({
              lastWatered: now,
              waterBoostUntil: boostUntil,
              version: sql`${plantedCrops.version} + 1`
            })
            .where(and(
              eq(plantedCrops.plotId, plotId),
              eq(plantedCrops.isHarvested, false)
            ));
          plantsWatered += result.rowCount || 0;
        }
      }

      // Update class garden
      await tx
        .update(classGardens)
        .set({ 
          lastWateredAt: now,
          updatedAt: now
        })
        .where(eq(classGardens.classId, classId));

      return { plantsWatered };
    });

    // Clear cache for all students in class
    await this.invalidateClassCache(classId);

    return {
      plantsWatered: result.plantsWatered,
      boostUntil
    };
    } catch (error) {
      console.error('waterClassGarden error:', error);
      throw error;
    }
  }

  /**
   * Calculate current growth stage and check if ready to harvest
   */
  calculateGrowthInfo(crop: PlantedCrop & { seed: SeedType }): {
    currentStage: number;
    percentComplete: number;
    isReady: boolean;
    minutesRemaining: number;
  } {
    const now = new Date();
    const plantedTime = crop.plantedAt.getTime();
    const harvestTime = crop.harvestReadyAt.getTime();
    
    // Check if water boost is active
    const hasBoost = crop.waterBoostUntil && crop.waterBoostUntil > now;
    const multiplier = hasBoost ? WATER_BOOST_MULTIPLIER : 1;
    
    // Calculate effective time passed
    const actualTimePassed = now.getTime() - plantedTime;
    const effectiveTimePassed = actualTimePassed * multiplier;
    
    // Calculate total grow time needed
    const totalGrowTime = harvestTime - plantedTime;
    
    // Calculate percentage
    const percentComplete = Math.min(100, (effectiveTimePassed / totalGrowTime) * 100);
    
    // Calculate stage (0-3)
    const currentStage = Math.floor(percentComplete / 25);
    
    // Calculate remaining time
    const remainingTime = Math.max(0, totalGrowTime - effectiveTimePassed);
    const minutesRemaining = Math.ceil(remainingTime / 60000);
    
    return {
      currentStage,
      percentComplete,
      isReady: percentComplete >= 100,
      minutesRemaining
    };
  }

  /**
   * Harvest a crop
   */
  async harvestCrop(
    studentId: string,
    cropId: string
  ): Promise<{
    coinsEarned: number;
    seedType: string;
  }> {
    const result = await db.transaction(async (tx) => {
      // Get crop with lock
      const [crop] = await tx
        .select({
          crop: plantedCrops,
          seed: seedTypes,
          plotStudentId: gardenPlots.studentId,
          plotClassId: gardenPlots.classId
        })
        .from(plantedCrops)
        .innerJoin(gardenPlots, eq(plantedCrops.plotId, gardenPlots.id))
        .innerJoin(seedTypes, eq(plantedCrops.seedType, seedTypes.id))
        .where(eq(plantedCrops.id, cropId))
        .for('update')
        .limit(1);

      if (!crop) {
        throw new NotFoundError('Crop');
      }

      if (crop.plotStudentId !== studentId) {
        throw new AuthorizationError('This is not your crop');
      }

      if (crop.crop.isHarvested) {
        throw new ConflictError('Crop already harvested');
      }

      // Check if ready
      const growthInfo = this.calculateGrowthInfo({ ...crop.crop, seed: crop.seed });
      if (!growthInfo.isReady) {
        throw new ValidationError(
          `Crop not ready. ${growthInfo.minutesRemaining} minutes remaining`
        );
      }

      // Calculate coins earned (with potential bonuses)
      const basePrice = crop.seed.baseSellPrice;
      const wasWatered = crop.crop.waterBoostUntil && crop.crop.waterBoostUntil > crop.crop.plantedAt;
      const coinsEarned = wasWatered ? Math.floor(basePrice * 1.2) : basePrice;

      // Mark as harvested
      await tx
        .update(plantedCrops)
        .set({ 
          isHarvested: true,
          version: sql`${plantedCrops.version} + 1`
        })
        .where(and(
          eq(plantedCrops.id, cropId),
          eq(plantedCrops.version, crop.crop.version) // Optimistic lock
        ));

      // Update student balance
      await tx
        .update(students)
        .set({
          currencyBalance: sql`${students.currencyBalance} + ${coinsEarned}`
        })
        .where(eq(students.id, studentId));

      // Log the harvest
      await tx.insert(harvestLogs).values({
        studentId,
        cropId,
        seedType: crop.seed.id,
        coinsEarned,
        growthTimeHours: crop.seed.baseGrowthHours,
        wasBoosted: wasWatered
      });

      // Update class statistics
      await tx
        .update(classGardens)
        .set({
          totalHarvests: sql`${classGardens.totalHarvests} + 1`,
          totalEarnings: sql`${classGardens.totalEarnings} + ${coinsEarned}`
        })
        .where(eq(classGardens.classId, crop.plotClassId));

      // Log transaction
      await tx.insert(currencyTransactions).values({
        studentId,
        amount: coinsEarned,
        transactionType: 'harvest',
        description: `Harvested ${crop.seed.name}`
      });

      return {
        coinsEarned,
        seedType: crop.seed.name
      };
    });

    // Clear cache
    await this.invalidateStudentCache(studentId);

    return result;
  }

  /**
   * Get complete garden view data
   */
  async getGardenView(plotId: string): Promise<{
    plot: GardenPlot;
    crops: (PlantedCrop & { growthInfo: any; seed: SeedType })[];
    decorations: any[];
  }> {
    const [plot] = await db
      .select()
      .from(gardenPlots)
      .where(eq(gardenPlots.id, plotId))
      .limit(1);

    if (!plot) {
      throw new NotFoundError('Garden plot');
    }

    // Get all crops with seed info
    const crops = await db
      .select({
        crop: plantedCrops,
        seed: seedTypes
      })
      .from(plantedCrops)
      .innerJoin(seedTypes, eq(plantedCrops.seedType, seedTypes.id))
      .where(and(
        eq(plantedCrops.plotId, plotId),
        eq(plantedCrops.isHarvested, false)
      ));

    // Calculate growth info for each crop
    const cropsWithGrowth = crops.map(({ crop, seed }) => ({
      ...crop,
      seed,
      growthInfo: this.calculateGrowthInfo({ ...crop, seed })
    }));

    // TODO: Get decorations when implemented

    return {
      plot,
      crops: cropsWithGrowth,
      decorations: []
    };
  }

  /**
   * Get class garden overview
   */
  async getClassGarden(classId: string) {
    console.log('getClassGarden called with classId:', classId);
    
    // Get class info
    let classData;
    try {
      const [result] = await db
        .select()
        .from(classes)
        .where(eq(classes.id, classId))
        .limit(1);

      if (!result) {
        throw new NotFoundError('Class not found');
      }
      
      classData = result;
      console.log('Found class:', classData.name);
    } catch (error) {
      console.error('Error fetching class data:', error);
      throw error;
    }

    // Get all students and their garden plots in the class
    let studentsWithPlots;
    try {
      console.log('Fetching students and plots for classId:', classId);
      studentsWithPlots = await db
        .select({
          student: {
            id: students.id,
            passportCode: students.passportCode,
            studentName: students.studentName,
            animalTypeId: students.animalTypeId,
            geniusTypeId: students.geniusTypeId,
            avatarData: students.avatarData
          },
          plot: gardenPlots,
          animalType: animalTypes,
          geniusType: geniusTypes
        })
        .from(students)
        .leftJoin(gardenPlots, eq(students.id, gardenPlots.studentId))
        .leftJoin(animalTypes, eq(students.animalTypeId, animalTypes.id))
        .leftJoin(geniusTypes, eq(students.geniusTypeId, geniusTypes.id))
        .where(eq(students.classId, classId));
      console.log('Found students:', studentsWithPlots.length);
      console.log('Student data sample:', studentsWithPlots[0]);
    } catch (error) {
      console.error('Error fetching students with plots:', error);
      throw error;
    }

    // Get all crops for all plots in the class
    const plotIds = studentsWithPlots
      .map(s => s.plot?.id)
      .filter((id): id is string => id !== null);
    
    let allCrops: any[] = [];
    try {
      console.log('Plot IDs:', plotIds);
      if (plotIds.length > 0) {
        allCrops = await db
          .select({
            crop: plantedCrops,
            seed: seedTypes
          })
          .from(plantedCrops)
          .innerJoin(seedTypes, eq(plantedCrops.seedType, seedTypes.id))
          .where(and(
            inArray(plantedCrops.plotId, plotIds),
            eq(plantedCrops.isHarvested, false)
          ));
        console.log('Found crops:', allCrops.length);
      }
    } catch (error) {
      console.error('Error fetching crops:', error);
      throw error;
    }

    // Calculate stats per student
    console.log('Mapping student data for', studentsWithPlots.length, 'students');
    const studentData = studentsWithPlots.map(({ student, plot, animalType, geniusType }) => {
      let growZone = null;
      
      if (plot) {
        const plotCrops = allCrops.filter(c => c.crop.plotId === plot.id);
        const readyCrops = plotCrops.filter(c => {
          const growthInfo = this.calculateGrowthInfo({
            ...c.crop,
            seed: c.seed
          });
          return growthInfo.isReady;
        });
        
        growZone = {
          plotPosition: plot.plotPosition,
          cropCount: plotCrops.length,
          readyCrops: readyCrops.length
        };
      }

      return {
        id: student.id,
        passportCode: student.passportCode,
        studentName: student.studentName,
        animalType: animalType?.name || 'Unknown',
        animalTypeId: animalType?.id || 'unknown',
        geniusType: geniusType?.name || '',
        avatarData: student.avatarData,
        growZone: growZone
      };
    });

    // Get last watered time from classGardens table
    const [classGarden] = await db
      .select({
        lastWateredAt: classGardens.lastWateredAt
      })
      .from(classGardens)
      .where(eq(classGardens.classId, classId))
      .limit(1);

    // Calculate overall stats
    const totalCrops = allCrops.length;
    const readyToHarvest = allCrops.filter(c => {
      const growthInfo = this.calculateGrowthInfo({
        ...c.crop,
        seed: c.seed
      });
      return growthInfo.isReady;
    }).length;

    const result = {
      classId: classData.id,
      className: classData.name,
      students: studentData,
      stats: {
        totalStudents: studentData.length,
        totalCrops,
        readyToHarvest
      },
      lastWatered: classGarden?.lastWateredAt || null
    };
    
    console.log('Returning class garden data:', {
      classId: result.classId,
      className: result.className,
      studentCount: result.students.length,
      stats: result.stats
    });
    
    return result;
  }

  /**
   * Invalidate caches
   */
  private async invalidateStudentCache(studentId: string): Promise<void> {
    const cache = getCache();
    const keys = [
      `garden-plot:${studentId}`,
      `student-inventory:${studentId}`
    ];
    await Promise.all(keys.map(key => cache.del(key)));
  }

  private async invalidateClassCache(classId: string): Promise<void> {
    const cache = getCache();
    // Get all students in class
    const studentsInClass = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.classId, classId));

    const keys = studentsInClass.map(s => `garden-plot:${s.id}`);
    await Promise.all(keys.map(key => cache.del(key)));
  }
}

// Export singleton instance
export const gardenService = new GardenService();

// Initialize seed types on startup
gardenService.initializeSeedTypes().catch(console.error);