import { Router } from 'express';
import { AuthenticatedRequest } from '../types/api';
import { db } from '../db';
import { quizSubmissions, students, classes, animalTypes, geniusTypes } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Get quiz submission details with student and class info
router.get('/:id/details', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const submissionId = authReq.params.id;
    
    // Get submission with all related data
    const submissionWithDetails = await db
      .select({
        submissionId: quizSubmissions.id,
        studentId: students.id,
        studentName: students.studentName,
        classId: classes.id,
        className: classes.name,
        teacherId: classes.teacherId,
        animalTypeName: animalTypes.name,
        animalTypeCode: animalTypes.code,
        geniusTypeName: geniusTypes.name,
        geniusTypeCode: geniusTypes.code,
        completedAt: quizSubmissions.completedAt,
        answers: quizSubmissions.answers
      })
      .from(quizSubmissions)
      .leftJoin(students, eq(quizSubmissions.studentId, students.id))
      .leftJoin(classes, eq(students.classId, classes.id))
      .leftJoin(animalTypes, eq(quizSubmissions.animalTypeId, animalTypes.id))
      .leftJoin(geniusTypes, eq(quizSubmissions.geniusTypeId, geniusTypes.id))
      .where(eq(quizSubmissions.id, submissionId))
      .limit(1);

    if (submissionWithDetails.length === 0) {
      return res.status(404).json({ message: "Submission not found" });
    }

    const submission = submissionWithDetails[0];
    
    // Check if user has access to this submission
    if (submission.teacherId !== authReq.user!.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Return formatted submission details
    res.json({
      id: submission.submissionId,
      studentId: submission.studentId,
      studentName: submission.studentName,
      classId: submission.classId,
      className: submission.className,
      animalType: submission.animalTypeName || submission.animalTypeCode,
      geniusType: submission.geniusTypeName || submission.geniusTypeCode,
      completedAt: submission.completedAt,
      answers: submission.answers
    });
  } catch (error: any) {
    console.error("Get submission details error:", error);
    res.status(500).json({ message: "Failed to fetch submission details" });
  }
});

export default router;