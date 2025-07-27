import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/api';
import { db } from '../db';
import { uuidStorage } from '../storage-uuid';
import { students, quizSubmissions, currencyTransactions, /* purchaseRequests, */ classes } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { validateParams, validateBody } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

// Validation schemas
const adminSchemas = {
  uuidParam: z.object({
    id: z.string().uuid('Invalid UUID format')
  }),
  updateAdminStatus: z.object({
    isAdmin: z.boolean()
  })
};

// Admin force delete class (deletes class and all associated data)
router.delete('/classes/:id/force', requireAuth, validateParams(adminSchemas.uuidParam), async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const classId = authReq.params.id;
    const teacherId = authReq.user!.userId;
    
    // Verify teacher owns the class or is admin
    const classRecord = await uuidStorage.getClassById(classId);
    const profile = await uuidStorage.getProfileById(teacherId);
    
    if (!classRecord || (classRecord.teacherId !== teacherId && !profile?.isAdmin)) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    // Delete in correct order to avoid foreign key constraints
    await db.transaction(async (tx) => {
      // 1. Get all students in the class
      const classStudents = await tx
        .select({ id: students.id })
        .from(students)
        .where(eq(students.classId, classId));
      
      console.log(`Found ${classStudents.length} students to delete`);
      
      if (classStudents.length > 0) {
        const studentIds = classStudents.map(s => s.id);
        
        // Delete all related data for students
        console.log(`Deleting quiz submissions...`);
        await tx.delete(quizSubmissions).where(inArray(quizSubmissions.studentId, studentIds));
        
        console.log(`Deleting currency transactions...`);
        await tx.delete(currencyTransactions).where(inArray(currencyTransactions.studentId, studentIds));
        
        // TODO: Uncomment when purchaseRequests table is defined
        // console.log(`Deleting purchase requests...`);
        // await tx.delete(purchaseRequests).where(inArray(purchaseRequests.studentId, studentIds));
        
        
        // 2. Delete all students in the class
        console.log(`Deleting students...`);
        await tx.delete(students).where(eq(students.classId, classId));
      }
      
      // 3. Delete the class itself
      console.log(`Deleting class...`);
      await tx.delete(classes).where(eq(classes.id, classId));
    });
    
    res.json({ message: "Class and all associated data deleted successfully" });
  } catch (error: any) {
    console.error("Force delete class error:", error);
    res.status(500).json({ message: "Failed to force delete class", error: error.message });
  }
});

// Get all teachers/profiles
router.get('/teachers', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const teachers = await uuidStorage.getAllProfiles();
    res.json(teachers);
  } catch (error) {
    console.error("Get all teachers error:", error);
    res.status(500).json({ message: "Failed to get teachers" });
  }
});

// Update admin status
router.put('/teachers/:id/admin', requireAuth, requireAdmin, validateParams(adminSchemas.uuidParam), validateBody(adminSchemas.updateAdminStatus), async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const teacherId = authReq.params.id;
    const { isAdmin } = authReq.body;
    
    const updatedProfile = await uuidStorage.updateProfileAdmin(teacherId, isAdmin);
    
    // Log admin action
    await uuidStorage.logAdminAction({
      adminId: authReq.user.userId,
      action: isAdmin ? 'GRANT_ADMIN' : 'REVOKE_ADMIN',
      targetUserId: teacherId,
      details: { 
        action: isAdmin ? 'granted' : 'revoked',
        targetEmail: updatedProfile.email 
      }
    });
    
    res.json(updatedProfile);
  } catch (error: any) {
    console.error("Update admin status error:", error);
    res.status(500).json({ message: "Failed to update admin status" });
  }
});

// Get all classes
router.get('/classes', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const classes = await uuidStorage.getAllClassesWithStats();
    res.json(classes);
  } catch (error) {
    console.error("Get all classes error:", error);
    res.status(500).json({ message: "Failed to get classes" });
  }
});

// Get admin stats
router.get('/stats', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const stats = await uuidStorage.getAdminStats();
    res.json(stats);
  } catch (error) {
    console.error("Get admin stats error:", error);
    res.status(500).json({ message: "Failed to get admin stats" });
  }
});

export default router;