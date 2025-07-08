import { Router, Request, Response } from 'express';
import { db } from '../db';
import { uuidStorage } from '../storage-uuid';
import { quizSubmissions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { canEditClass } from '../db/collaborators';

const router = Router();

// Delete submission
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const submissionId = req.params.id;
    const submission = await uuidStorage.getSubmissionById(submissionId);
    
    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }
    
    // Get student to access class info
    const student = await uuidStorage.getStudentById(submission.studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    // Get class info to verify teacher access
    const classRecord = await uuidStorage.getClassById(student.classId);
    if (!classRecord) {
      return res.status(404).json({ message: "Class not found" });
    }
    
    // Check if user can edit this class (owner or editor collaborator)
    const hasEditAccess = await canEditClass(req.user!.userId, student.classId);
    if (!hasEditAccess) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    // Delete the submission
    await db.delete(quizSubmissions).where(eq(quizSubmissions.id, submissionId));
    
    res.json({ message: "Submission deleted successfully" });
  } catch (error: any) {
    console.error("Delete submission error:", error);
    res.status(500).json({ message: "Failed to delete submission" });
  }
});

export default router;