// @ts-nocheck
// Debug route - not critical for production, contains legacy column references
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { classes, profiles, teacherPayments } from '../../shared/schema';
import { authenticateTeacher } from '../middleware/auth';

const router = Router();

// Debug endpoint to check database state
router.get('/debug-payment-data', authenticateTeacher, async (req: any, res) => {
  try {
    console.log('Debug endpoint - req.user:', req.user);
    const teacherId = req.user?.id || req.user?.userId;
    
    if (!teacherId) {
      return res.status(401).json({ error: 'No teacher ID found in request', user: req.user });
    }
    
    // Get all classes
    const allClasses = await db.select({
      id: classes.id,
      name: classes.name,
      teacherId: classes.teacherId,
      paymentStatus: classes.paymentStatus
    }).from(classes);
    
    // Get teacher profile
    const teacherProfile = await db.select({
      id: profiles.id,
      email: profiles.email,
      fullName: profiles.fullName
    }).from(profiles).where(eq(profiles.id, teacherId));
    
    // Get any existing payments
    const payments = await db.select().from(teacherPayments);
    
    res.json({
      currentTeacherId: teacherId,
      teacherProfile: teacherProfile[0] || null,
      allClasses: allClasses,
      totalClasses: allClasses.length,
      classesOwnedByCurrentTeacher: allClasses.filter(c => c.teacherId === teacherId),
      existingPayments: payments
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: 'Failed to get debug data' });
  }
});

export default router;
