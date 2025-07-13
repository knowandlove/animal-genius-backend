import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/api';
import { uuidStorage } from '../storage-uuid';
import { requireAuth } from '../middleware/auth';
import { parseSubmissionDetails } from '../utils/submission-parser';
import { generateClassInsights } from '../services/pairingService';
import { asyncWrapper } from '../utils/async-wrapper';
import { NotFoundError, AuthorizationError, InternalError, ErrorCode } from '../utils/errors';
import { createSecureLogger } from '../utils/secure-logger';

const logger = createSecureLogger('AnalyticsRoutes');

const router = Router();

// Get student data for teacher view
router.get('/teacher/students/:studentId', requireAuth, asyncWrapper(async (req, res, next) => {
  const authReq = req as AuthenticatedRequest;
  const studentId = authReq.params.studentId;
  const teacherId = authReq.user!.userId;
  
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
  
  if (classRecord.teacherId !== teacherId) {
    throw new AuthorizationError('Access denied', ErrorCode.AUTH_005);
  }
  
  // Get the student's submissions (allow empty for students who haven't taken quiz)
  const submissions = await uuidStorage.getSubmissionsByStudentId(studentId);
  
  // Get the latest submission if available
  const latestSubmission = submissions.length > 0 ? submissions[0] : null;
    
    // Parse answers using helper
    const parsedDetails = parseSubmissionDetails(latestSubmission, student);
    
    // Get the student's balance
    const balance = await uuidStorage.getStudentBalance(studentId);
    
    // Format response similar to what teacher-student-view expects
    const response = {
      id: latestSubmission?.id || null,
      studentId: student.id,
      studentName: student.studentName || 'Unknown',
      gradeLevel: parsedDetails.gradeLevel,
      animalType: latestSubmission?.animalType || null,
      geniusType: latestSubmission?.geniusType || null,
      personalityType: parsedDetails.personalityType,
      learningStyle: parsedDetails.learningStyle,
      learningScores: parsedDetails.learningScores,
      scores: parsedDetails.scores,
      completedAt: latestSubmission?.completedAt || null,
      passportCode: student.passportCode,
      currencyBalance: balance,
      hasCompletedQuiz: !!latestSubmission,
      class: {
        id: classRecord.id,
        name: classRecord.name,
        code: classRecord.classCode
      }
    };
    
    res.json(response);
}));

export default router;