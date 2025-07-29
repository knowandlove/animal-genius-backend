import { Router } from 'express';
import { uuidStorage } from '../storage-uuid';
import { apiLimiter } from '../middleware/rateLimiter';
import { validateClassAccess } from '../middleware/validate-class';
import { createQuizSubmissionFast } from '../services/quizSubmissionService';
import { db } from '../db';
import { classes } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { metricsService } from '../monitoring/metrics-service';

const router = Router();

// Use the general API rate limiter for quiz submissions
const quizLimiter = apiLimiter;

// Legacy quiz submission endpoint (for backward compatibility)
// New frontend should use Supabase Edge Functions directly
router.post('/submissions', quizLimiter, validateClassAccess, async (req, res) => {
  const startTime = Date.now();
  
  // Track student join attempt
  metricsService.trackStudentJoin('attempt', { classId: req.body.classId });
  
  try {
    const { studentName, gradeLevel, classId, animalType, geniusType, answers, personalityType, learningStyle, scores, learningScores } = req.body;
    
    // Validate required fields
    if (!studentName?.trim()) {
      metricsService.trackStudentJoin('failure', { reason: 'missing_name' });
      return res.status(400).json({ message: "Student name is required" });
    }
    if (!gradeLevel?.trim()) {
      metricsService.trackStudentJoin('failure', { reason: 'missing_grade' });
      return res.status(400).json({ message: "Grade level is required" });
    }
    if (!animalType?.trim()) {
      metricsService.trackStudentJoin('failure', { reason: 'missing_animal' });
      return res.status(400).json({ message: "Animal type is required" });
    }
    
    // Use the fast submission service
    const submission = await createQuizSubmissionFast({
      studentName,
      gradeLevel,
      classId,
      animalType,
      geniusType: geniusType || '',
      answers: {
        ...answers,
        personalityType,
        learningStyle,
        learningScores,
        scores,
      },
      personalityType,
      learningStyle: learningStyle || 'visual',
    });
    
    // Track successful student join
    const duration = Date.now() - startTime;
    metricsService.trackStudentJoin('success', { 
      classId, 
      duration,
      animalType,
      passportCode: submission.passportCode 
    });
    
    // Return the student's passport code
    res.json({
      ...submission,
      studentId: submission.studentId,
      message: 'Quiz completed successfully!'
    });
  } catch (error) {
    console.error("Submit quiz submission error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to submit quiz";
    
    // Track failure
    metricsService.trackStudentJoin('failure', { 
      reason: 'submission_error',
      error: errorMessage 
    });
    
    res.status(400).json({ message: errorMessage });
  }
});

// New endpoint to check quiz eligibility (proxy to Edge Function)
router.post('/check-eligibility', apiLimiter, async (req, res) => {
  try {
    const { classCode, firstName, lastInitial, grade } = req.body;
    
    // Basic validation
    if (!classCode || !firstName || !lastInitial) {
      return res.status(400).json({ 
        eligible: false,
        reason: 'MISSING_FIELDS',
        message: 'Missing required fields' 
      });
    }
    
    // Check class exists
    const [classData] = await db
      .select()
      .from(classes)
      .where(eq(classes.classCode, classCode.toUpperCase()))
      .limit(1);
      
    if (!classData || classData.isArchived) {
      return res.json({
        eligible: false,
        reason: 'INVALID_CLASS',
        message: 'This class code is not valid.'
      });
    }
    
    // For now, return eligible (full validation happens in Edge Function)
    res.json({
      eligible: true,
      warnings: [],
      classInfo: {
        name: classData.name,
        id: classData.id
      }
    });
  } catch (error) {
    console.error('Check eligibility error:', error);
    res.status(500).json({ 
      error: 'Failed to check eligibility' 
    });
  }
});

export default router;