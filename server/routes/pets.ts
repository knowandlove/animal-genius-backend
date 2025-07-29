// Pet System Routes
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireUnifiedAuth, requireStudent } from '../middleware/unified-auth';
import { validateOwnDataAccess } from '../middleware/validate-student-class';
import { storePurchaseLimiter, storeBrowsingLimiter } from '../middleware/rateLimiter';
import { optionalAuth } from '../middleware/auth';
import { db } from '../db';
import { students } from '@shared/schema';
import { eq } from 'drizzle-orm';
import {
  getAvailablePets,
  getStudentPet,
  purchasePet,
  interactWithPet,
  updatePetPosition,
  renamePet
} from '../services/petService';
import { validatePetName } from '../utils/profanityFilter';
import { asyncWrapper } from '../utils/async-wrapper';
import { ValidationError, BusinessError, InternalError, ErrorCode } from '../utils/errors';
import { createSecureLogger } from '../utils/secure-logger';

const logger = createSecureLogger('PetRoutes');

const router = Router();

logger.log('Pets router loaded');

/**
 * Middleware that allows either student session or teacher auth
 * Teachers can interact with any pet, students only with their own
 */
async function flexiblePetAuth(req: Request, res: Response, next: NextFunction) {
  // Use unified auth which handles both student and teacher authentication
  return requireUnifiedAuth(req, res, (err) => {
    if (err) return; // Error already handled by unified auth
    
    // After this, we can check req.auth.role to determine if it's a student or teacher
    if (req.auth?.role === 'teacher') {
      // For teachers, we'll need to determine which student's pet this is
      // This will be handled in the service layer
      req.isTeacher = true;
    }
    
    next();
  });
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      isTeacher?: boolean;
    }
  }
}

// Validation schemas
const purchasePetSchema = z.object({
  petId: z.string().uuid(),
  customName: z.string().min(1).max(50)
});

const interactSchema = z.object({
  interactionType: z.enum(['feed', 'play', 'pet'])
});

const positionSchema = z.object({
  x: z.number().min(0).max(800),
  y: z.number().min(0).max(600)
});

const renameSchema = z.object({
  newName: z.string().min(1).max(50)
});

/**
 * GET /api/pets/catalog
 * Get all available pets
 */
router.get('/catalog', storeBrowsingLimiter, asyncWrapper(async (req, res, _next) => {
  logger.debug('Pet catalog endpoint hit');
  const pets = await getAvailablePets();
  res.json(pets);
}));

/**
 * GET /api/pets/my-pet
 * Get student's pet with current state
 * Requires student authentication
 */
router.get('/my-pet', requireUnifiedAuth, requireStudent, asyncWrapper(async (req, res, _next) => {
  // Bridge: Set req.studentId for legacy compatibility
  if (req.auth?.role === 'student') {
    (req as any).studentId = req.auth.studentId;
  }
  
  const studentId = req.studentId!;
  const pet = await getStudentPet(studentId);
  
  if (!pet) {
    res.json({ pet: null });
    return;
  }
  
  res.json({ pet });
}));

/**
 * POST /api/pets/purchase
 * Purchase a pet
 * Requires student authentication
 */
router.post('/purchase', requireUnifiedAuth, requireStudent, storePurchaseLimiter, asyncWrapper(async (req, res, _next) => {
  // Bridge: Set req.studentId for legacy compatibility
  if (req.auth?.role === 'student') {
    (req as any).studentId = req.auth.studentId;
  }
  
  logger.debug('Pet purchase request', {
    studentId: req.studentId
  });
  
  const studentId = req.studentId!;
  const { petId, customName } = purchasePetSchema.parse(req.body);
  
  logger.debug('Parsed purchase data', { studentId, petId });
  
  // Validate pet name for profanity
  const nameValidation = validatePetName(customName);
  if (!nameValidation.isValid) {
    logger.debug('Pet name validation failed', { reason: nameValidation.reason });
    throw new ValidationError(
      'Invalid pet name: ' + nameValidation.reason,
      ErrorCode.VAL_003
    );
  }
  
  logger.debug('Calling purchasePet service');
  const result = await purchasePet(studentId, petId, nameValidation.cleanedName!);
  
  logger.debug('Purchase result', { success: result.success });
  
  if (!result.success) {
    if (result.error === 'Student already has a pet') {
      throw new BusinessError(result.error, ErrorCode.BIZ_002);
    } else if (result.error === 'Insufficient balance') {
      throw new BusinessError(result.error, ErrorCode.BIZ_001);
    }
    throw new BusinessError(result.error || 'Failed to purchase pet', ErrorCode.BIZ_001);
  }
  
  res.json({ 
    success: true, 
    pet: result.studentPet 
  });
}));

/**
 * POST /api/pets/:petId/interact
 * Interact with a pet (feed, play, pet)
 * Requires student or teacher authentication
 */
router.post('/:petId/interact', optionalAuth, flexiblePetAuth, storePurchaseLimiter, asyncWrapper(async (req, res, _next) => {
  const petId = req.params.petId;
  const { interactionType } = interactSchema.parse(req.body);
  
  let studentId = req.studentId;
  
  // If teacher, we need to find the student who owns this pet
  if (req.isTeacher && !studentId) {
    // For teachers, we'll pass a special flag to the service
    // The service will handle the ownership check
    studentId = 'teacher-override';
  }
  
  if (!studentId) {
    throw new BusinessError('Unable to determine pet owner', ErrorCode.BIZ_001);
  }
  
  const result = await interactWithPet(petId, interactionType, studentId);
  
  if (!result.success) {
    throw new BusinessError(result.error || 'Failed to interact with pet', ErrorCode.BIZ_001);
  }
  
  res.json({ 
    success: true, 
    newStats: result.newStats 
  });
}));

/**
 * PUT /api/pets/:petId/position
 * Update pet position in room
 * Requires student authentication
 */
router.put('/:petId/position', requireUnifiedAuth, requireStudent, asyncWrapper(async (req, res, _next) => {
  const studentId = req.studentId!;
  const petId = req.params.petId;
  const position = positionSchema.parse(req.body);
  
  const success = await updatePetPosition(petId, studentId, position);
  
  if (!success) {
    throw new BusinessError('Failed to update position', ErrorCode.BIZ_001);
  }
  
  res.json({ success: true });
}));

/**
 * PUT /api/pets/:petId/rename
 * Rename a pet
 * Requires student authentication
 */
router.put('/:petId/rename', requireUnifiedAuth, requireStudent, asyncWrapper(async (req, res, _next) => {
  const studentId = req.studentId!;
  const petId = req.params.petId;
  const { newName } = renameSchema.parse(req.body);
  
  // Validate new name for profanity
  const nameValidation = validatePetName(newName);
  if (!nameValidation.isValid) {
    throw new ValidationError(
      'Invalid pet name: ' + nameValidation.reason,
      ErrorCode.VAL_003
    );
  }
  
  const success = await renamePet(petId, studentId, nameValidation.cleanedName!);
  
  if (!success) {
    throw new BusinessError('Failed to rename pet', ErrorCode.BIZ_001);
  }
  
  res.json({ success: true });
}));

/**
 * GET /api/pets/:passportCode/pet
 * Get a student's pet by passport code (public endpoint for viewing other students' pets)
 */
router.get('/:passportCode/pet', storeBrowsingLimiter, validateOwnDataAccess, asyncWrapper(async (req, res, _next) => {
  const studentId = res.locals.studentId;
  const pet = await getStudentPet(studentId);
  
  if (!pet) {
    res.json({ pet: null });
    return;
  }
  
  // For public viewing, only return basic info and calculated stats
  res.json({
    pet: {
      customName: pet.customName,
      species: pet.pet.species,
      assetUrl: pet.pet.assetUrl,
      calculatedStats: pet.calculatedStats,
      visualState: pet.visualState,
      position: pet.position
    }
  });
}));

export default router;