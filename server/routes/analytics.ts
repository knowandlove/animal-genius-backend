import { Router, Request, Response } from 'express';
import { uuidStorage } from '../storage-uuid';
import { requireAuth } from '../middleware/auth';
import { parseSubmissionDetails } from '../utils/submission-parser';
import { generateClassInsights } from '../services/pairingService';
import { hasClassAccess } from '../db/collaborators';
import { asyncWrapper } from '../utils/async-wrapper';
import { NotFoundError, AuthorizationError, InternalError, ErrorCode } from '../utils/errors';
import { createSecureLogger } from '../utils/secure-logger';

const logger = createSecureLogger('AnalyticsRoutes');

const router = Router();

// Get student data for teacher view
router.get('/teacher/students/:studentId', requireAuth, asyncWrapper(async (req: Request, res: Response, next) => {
  const studentId = req.params.studentId;
  const teacherId = req.user!.userId;
  
  // Get the student
  const student = await uuidStorage.getStudentById(studentId);
  if (!student) {
    throw new NotFoundError('Student not found', ErrorCode.RES_001);
  }
  
  // Verify teacher has access to the class
  const classRecord = await uuidStorage.getClassById(student.classId);
  if (!classRecord) {
    throw new NotFoundError('Class not found', ErrorCode.RES_001);
  }
  
  const hasAccess = await hasClassAccess(teacherId, student.classId);
  if (!hasAccess) {
    throw new AuthorizationError('Access denied', ErrorCode.AUTH_005);
  }
  
  // Get the student's submissions
  const submissions = await uuidStorage.getSubmissionsByStudentId(studentId);
  if (submissions.length === 0) {
    throw new NotFoundError('No submissions found for this student', ErrorCode.RES_001);
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
}));

export default router;