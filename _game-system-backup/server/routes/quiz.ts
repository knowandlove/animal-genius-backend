import { Router } from 'express';
import { uuidStorage } from '../storage-uuid';
import { apiLimiter } from '../middleware/rateLimiter';
import { validateClassAccess } from '../middleware/validate-class';

const router = Router();

// Use the general API rate limiter for quiz submissions
const quizLimiter = apiLimiter;

// Submit quiz
router.post('/submissions', quizLimiter, validateClassAccess, async (req, res) => {
  try {
    const { studentName, gradeLevel, classId, animalType, geniusType, answers, personalityType, learningStyle, scores, learningScores } = req.body;
    
    // Validate required fields
    if (!studentName?.trim()) {
      return res.status(400).json({ message: "Student name is required" });
    }
    if (!gradeLevel?.trim()) {
      return res.status(400).json({ message: "Grade level is required" });
    }
    // Class validation is now handled by middleware
    const classRecord = (req as any).classData;
    
    // Create or get student using upsert to prevent race conditions
    const student = await uuidStorage.upsertStudent({
      classId: classId,
      studentName: studentName,
      gradeLevel: gradeLevel,
      personalityType: personalityType,
      animalType: animalType,
      geniusType: geniusType || '',
      learningStyle: learningStyle || 'visual',
    });
    
    // Validate required fields for quiz submission
    if (!animalType?.trim()) {
      return res.status(400).json({ message: "Animal type is required" });
    }
    if (!geniusType?.trim()) {
      return res.status(400).json({ message: "Genius type is required" });
    }
    
    // Create quiz submission and award coins in a transaction
    const submission = await uuidStorage.submitQuizAndAwardCoins(
      {
        studentId: student.id,
        animalType: animalType,
        geniusType: geniusType,
        answers: {
          ...answers,
          personalityType: personalityType,
          learningStyle: learningStyle,
          learningScores: learningScores,
          scores: scores,
          gradeLevel: gradeLevel
        },
        coinsEarned: 50,
      },
      {
        studentId: student.id,
        teacherId: classRecord.teacherId,
        amount: 50,
        transactionType: 'quiz_complete',
        description: 'Quiz completion reward',
      }
    );
    
    // Return the student's passport code
    res.json({
      ...submission,
      passportCode: student.passportCode,
      studentId: student.id,
      message: 'Quiz completed successfully!'
    });
  } catch (error) {
    console.error("Submit quiz submission error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to submit quiz";
    res.status(400).json({ message: errorMessage });
  }
});

export default router;