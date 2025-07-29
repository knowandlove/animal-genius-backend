import { Router } from 'express';
import { db } from '../../db';
import { pets, studentPets } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import multer from 'multer';
import { getCache } from '../../lib/cache-factory';
import { EnhancedStorageService } from '../../services/enhanced-storage-service';

const cache = getCache();

const router = Router();

// All routes require admin authentication
router.use(requireAuth);
router.use(requireAdmin);

// Import animation types
import { SpriteSheetMetadata, DEFAULT_ANIMATIONS } from '../../types/pet-animations';

// Validation schemas
const createPetSchema = z.object({
  species: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  assetUrl: z.string().url(),
  cost: z.number().int().min(0),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']),
  baseStats: z.object({
    hungerDecayRate: z.number().min(0).max(10),
    happinessDecayRate: z.number().min(0).max(10),
    spriteMetadata: z.object({
      frameCount: z.number().int().min(1).max(20),
      frameWidth: z.number().int().min(1).max(512),
      frameHeight: z.number().int().min(1).max(512),
      animationSpeed: z.number().int().min(50).max(1000),
      // New fields for multi-animation support
      imageWidth: z.number().int().optional(),
      imageHeight: z.number().int().optional(),
      animationRows: z.number().int().min(1).max(20).default(1),
      scale: z.number().min(0.5).max(5).default(2),
      pixelated: z.boolean().default(true),
    }).optional(),
  }),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const updatePetSchema = createPetSchema.partial();

const spriteMetadataSchema = z.object({
  frameCount: z.number().int().min(1).max(20),
  frameWidth: z.number().int().min(1).max(512),
  frameHeight: z.number().int().min(1).max(512),
  animationSpeed: z.number().int().min(50).max(1000),
  // Extended fields for multi-animation support
  imageWidth: z.number().int().optional(),
  imageHeight: z.number().int().optional(),
  animationRows: z.number().int().min(1).max(20).default(1),
  scale: z.number().min(0.5).max(5).default(2),
  pixelated: z.boolean().default(true),
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPEG, GIF, and WebP are allowed.'));
    }
  },
});

/**
 * GET /api/admin/pets
 * Get all pets with ownership stats
 */
router.get('/', async (_req, res) => {
  try {
    // Get all pets with ownership count
    const petsWithStats = await db
      .select({
        pet: pets,
        ownerCount: sql<number>`COUNT(DISTINCT ${studentPets.studentId})`,
      })
      .from(pets)
      .leftJoin(studentPets, eq(pets.id, studentPets.petId))
      .groupBy(pets.id)
      .orderBy(pets.sortOrder, pets.name);

    res.json(petsWithStats.map(p => ({
      ...p.pet,
      ownerCount: Number(p.ownerCount),
    })));
  } catch (error) {
    console.error('Error fetching pets:', error);
    res.status(500).json({ message: 'Failed to fetch pets' });
  }
});

/**
 * GET /api/admin/pets/:id
 * Get a specific pet by ID
 */
router.get('/:id', async (_req, res) => {
  try {
    const [pet] = await db
      .select()
      .from(pets)
      .where(eq(pets.id, req.params.id))
      .limit(1);

    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' });
    }

    res.json(pet);
  } catch (error) {
    console.error('Error fetching pet:', error);
    res.status(500).json({ message: 'Failed to fetch pet' });
  }
});

/**
 * POST /api/admin/pets
 * Create a new pet
 */
router.post('/', async (_req, res) => {
  try {
    const validatedData = createPetSchema.parse(req.body);

    const [newPet] = await db
      .insert(pets)
      .values({
        ...validatedData,
        baseStats: validatedData.baseStats,
      })
      .returning();

    // Clear pet catalog cache
    cache.del('pet-catalog:active');
    
    res.status(201).json(newPet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid pet data', 
        errors: error.errors 
      });
    }
    console.error('Error creating pet:', error);
    res.status(500).json({ message: 'Failed to create pet' });
  }
});

/**
 * PUT /api/admin/pets/:id
 * Update a pet
 */
router.put('/:id', async (_req, res) => {
  try {
    const validatedData = updatePetSchema.parse(req.body);

    const [updatedPet] = await db
      .update(pets)
      .set({
        ...validatedData,
        baseStats: validatedData.baseStats,
        updatedAt: new Date(),
      })
      .where(eq(pets.id, req.params.id))
      .returning();

    if (!updatedPet) {
      return res.status(404).json({ message: 'Pet not found' });
    }

    // Clear pet catalog cache
    cache.del('pet-catalog:active');
    
    res.json(updatedPet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid pet data', 
        errors: error.errors 
      });
    }
    console.error('Error updating pet:', error);
    res.status(500).json({ message: 'Failed to update pet' });
  }
});

/**
 * DELETE /api/admin/pets/:id
 * Soft delete a pet (set inactive)
 */
router.delete('/:id', async (_req, res) => {
  try {
    // Soft delete by setting inactive
    // Existing owners keep their pets, but no new purchases allowed
    const [deletedPet] = await db
      .update(pets)
      .set({ 
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(pets.id, req.params.id))
      .returning();

    if (!deletedPet) {
      return res.status(404).json({ message: 'Pet not found' });
    }

    // Clear pet catalog cache
    cache.del('pet-catalog:active');
    
    res.json({ message: 'Pet deleted successfully', pet: deletedPet });
  } catch (error) {
    console.error('Error deleting pet:', error);
    res.status(500).json({ message: 'Failed to delete pet' });
  }
});

/**
 * POST /api/admin/pets/:id/upload-sprite
 * Upload a sprite sheet for a pet
 */
router.post('/:id/upload-sprite', upload.single('sprite'), async (_req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Validate sprite metadata if provided
    let spriteMetadata = null;
    if (req.body.spriteMetadata) {
      try {
        spriteMetadata = spriteMetadataSchema.parse(JSON.parse(req.body.spriteMetadata));
      } catch (error) {
        return res.status(400).json({ 
          message: 'Invalid sprite metadata',
          errors: error instanceof z.ZodError ? error.errors : undefined
        });
      }
    }

    // Upload the sprite sheet
    const uploadResult = await EnhancedStorageService.upload({
      buffer: req.file.buffer,
      metadata: {
        bucket: 'public-assets',
        folder: 'pets',
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        type: 'animal',
        category: 'pets',
        name: req.file.originalname
      }
    });
    const assetUrl = uploadResult.path;

    // Update pet with new asset URL and sprite metadata
    const updateData: any = {
      assetUrl,
      updatedAt: new Date(),
    };

    // Store sprite metadata in the pet record if provided
    if (spriteMetadata) {
      // Use a transaction to prevent race conditions
      await db.transaction(async (tx) => {
        const [currentPet] = await tx
          .select()
          .from(pets)
          .where(eq(pets.id, req.params.id))
          .limit(1);

        if (currentPet) {
          // Auto-populate animations if we have multiple rows
          const enhancedMetadata: SpriteSheetMetadata = {
            ...spriteMetadata,
            imageWidth: spriteMetadata.imageWidth || (spriteMetadata.frameWidth * spriteMetadata.frameCount),
            imageHeight: spriteMetadata.imageHeight || (spriteMetadata.frameHeight * (spriteMetadata.animationRows || 1)),
          };
          
          // If we have a standard 8-row sprite sheet, add default animations
          if (spriteMetadata.animationRows === 8) {
            enhancedMetadata.animations = DEFAULT_ANIMATIONS;
          }
          
          updateData.baseStats = {
            ...(currentPet.baseStats as any),
            spriteMetadata: enhancedMetadata,
          };
        }
      });
    }

    const [updatedPet] = await db
      .update(pets)
      .set(updateData)
      .where(eq(pets.id, req.params.id))
      .returning();

    if (!updatedPet) {
      return res.status(404).json({ message: 'Pet not found' });
    }

    // Clear pet catalog cache
    cache.del('pet-catalog:active');
    
    res.json({ 
      message: 'Sprite uploaded successfully', 
      pet: updatedPet,
      assetUrl,
    });
  } catch (error) {
    console.error('Error uploading sprite:', error);
    res.status(500).json({ message: 'Failed to upload sprite' });
  }
});

export default router;