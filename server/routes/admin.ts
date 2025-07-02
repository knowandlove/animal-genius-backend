import { Router, Request, Response } from 'express';
import { db } from '../db';
import { uuidStorage } from '../storage-uuid';
import { students, quizSubmissions, currencyTransactions, /* purchaseRequests, */ classes } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { authenticateAdmin, requireAuth } from '../middleware/auth';

const router = Router();

// Admin force delete class (deletes class and all associated data)
router.delete('/classes/:id/force', requireAuth, async (req: Request, res: Response) => {
  try {
    const classId = req.params.id;
    const teacherId = req.user!.userId;
    
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
router.get('/teachers', authenticateAdmin, async (req: any, res) => {
  try {
    const teachers = await uuidStorage.getAllProfiles();
    res.json(teachers);
  } catch (error) {
    console.error("Get all teachers error:", error);
    res.status(500).json({ message: "Failed to get teachers" });
  }
});

// Update admin status
router.put('/teachers/:id/admin', authenticateAdmin, async (req: any, res) => {
  try {
    const teacherId = req.params.id;
    const { isAdmin } = req.body;
    
    const updatedProfile = await uuidStorage.updateProfileAdmin(teacherId, isAdmin);
    
    // Log admin action
    await uuidStorage.logAdminAction({
      adminId: req.user.userId,
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
router.get('/classes', authenticateAdmin, async (req: any, res) => {
  try {
    const classes = await uuidStorage.getAllClassesWithStats();
    res.json(classes);
  } catch (error) {
    console.error("Get all classes error:", error);
    res.status(500).json({ message: "Failed to get classes" });
  }
});

// Get admin stats
router.get('/stats', authenticateAdmin, async (req: any, res) => {
  try {
    const stats = await uuidStorage.getAdminStats();
    res.json(stats);
  } catch (error) {
    console.error("Get admin stats error:", error);
    res.status(500).json({ message: "Failed to get admin stats" });
  }
});

export default router;