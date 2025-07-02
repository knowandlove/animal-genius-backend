import { Router, Request, Response } from 'express';
import { uuidStorage } from '../storage-uuid';
import { requireAuth } from '../middleware/auth';
import { parseSubmissionDetails } from '../utils/submission-parser';
import { generateClassInsights } from '../services/pairingService';

const router = Router();

// Get student data for teacher view
router.get('/teacher/students/:studentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = req.params.studentId;
    const teacherId = req.user!.userId;
    
    // Get the student
    const student = await uuidStorage.getStudentById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    // Verify teacher owns the class
    const classRecord = await uuidStorage.getClassById(student.classId);
    if (!classRecord || classRecord.teacherId !== teacherId) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    // Get the student's submissions
    const submissions = await uuidStorage.getSubmissionsByStudentId(studentId);
    if (submissions.length === 0) {
      return res.status(404).json({ message: "No submissions found for this student" });
    }
    
    // Get the latest submission (already sorted by storage method)
    const latestSubmission = submissions[0];
    
    // Parse answers using helper
    const parsedDetails = parseSubmissionDetails(latestSubmission, student);
    
    // Get the student's balance
    const balance = await uuidStorage.getStudentBalance(studentId);
    
    // Format response similar to what teacher-student-view expects
    const response = {
      id: latestSubmission.id,
      studentId: student.id,
      studentName: student.studentName || 'Unknown',
      gradeLevel: parsedDetails.gradeLevel,
      animalType: parsedDetails.animalType || latestSubmission.animalTypeId,
      geniusType: latestSubmission.geniusType, // Fixed: was animalGenius
      personalityType: parsedDetails.personalityType,
      learningStyle: parsedDetails.learningStyle,
      learningScores: parsedDetails.learningScores,
      scores: parsedDetails.scores,
      completedAt: latestSubmission.completedAt,
      passportCode: student.passportCode,
      currencyBalance: balance,
      class: {
        id: classRecord.id,
        name: classRecord.name,
        code: classRecord.classCode
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error("Get student data error:", error);
    res.status(500).json({ message: "Failed to get student data" });
  }
});

export default router;