import { Router } from 'express';
import { requireStudentAuth, optionalStudentAuth, requireStudentInClass } from '../middleware/passport-auth';
import { supabaseAdmin } from '../supabase-clients';
import { createSecureLogger } from '../utils/secure-logger';

const router = Router();
const logger = createSecureLogger('StudentPassportAPI');

/**
 * GET /api/student-passport/profile
 * Get current student's profile information
 */
router.get('/profile', requireStudentAuth, async (req, res) => {
  try {
    const student = req.student!; // We know it exists because of requireStudentAuth
    
    res.json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        animalType: student.animalType,
        geniusType: student.geniusType,
        schoolYear: student.schoolYear,
        passportCode: student.passportCode
      }
    });
  } catch (error) {
    logger.error('Failed to get student profile:', error);
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

/**
 * GET /api/student-passport/class-info
 * Get information about the student's class
 */
router.get('/class-info', requireStudentAuth, async (req, res) => {
  try {
    const student = req.student!;
    
    // Get class information
    const { data: classData, error } = await supabaseAdmin
      .from('classes')
      .select('id, name, subject, grade_level, teacher_id')
      .eq('id', student.classId)
      .single();
    
    if (error) {
      logger.error('Failed to fetch class data:', error);
      return res.status(500).json({ error: 'Failed to retrieve class information' });
    }
    
    // Get classmates count
    const { count: classmatesCount } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', student.classId);
    
    res.json({
      success: true,
      class: {
        id: classData.id,
        name: classData.name,
        subject: classData.subject,
        gradeLevel: classData.grade_level,
        studentCount: classmatesCount || 0
      }
    });
  } catch (error) {
    logger.error('Failed to get class info:', error);
    res.status(500).json({ error: 'Failed to retrieve class information' });
  }
});

/**
 * GET /api/student-passport/progress
 * Get student's quiz progress and scores
 */
router.get('/progress', requireStudentAuth, async (req, res) => {
  try {
    const student = req.student!;
    
    // Get student's quiz data
    const { data: studentData, error } = await supabaseAdmin
      .from('students')
      .select('animal_type, created_at')
      .eq('id', student.id)
      .single();
    
    if (error) {
      logger.error('Failed to fetch student progress:', error);
      return res.status(500).json({ error: 'Failed to retrieve progress' });
    }
    
    res.json({
      success: true,
      progress: {
        // Removed quizScore as this is a personality quiz without numeric scores
        animalType: studentData.animal_type,
        completedAt: studentData.created_at,
        achievements: [] // Placeholder for future achievements system
      }
    });
  } catch (error) {
    logger.error('Failed to get student progress:', error);
    res.status(500).json({ error: 'Failed to retrieve progress' });
  }
});

/**
 * GET /api/student-passport/classmates
 * Get list of classmates (names only for privacy)
 */
router.get('/classmates', requireStudentAuth, async (req, res) => {
  try {
    const student = req.student!;
    
    // Get classmates
    const { data: classmates, error } = await supabaseAdmin
      .from('students')
      .select('student_name, animal_type, created_at')
      .eq('class_id', student.classId)
      .neq('id', student.id) // Exclude current student
      .order('created_at', { ascending: true });
    
    if (error) {
      logger.error('Failed to fetch classmates:', error);
      return res.status(500).json({ error: 'Failed to retrieve classmates' });
    }
    
    res.json({
      success: true,
      classmates: classmates.map(mate => ({
        name: mate.student_name,
        animalType: mate.animal_type,
        joinedAt: mate.created_at
      }))
    });
  } catch (error) {
    logger.error('Failed to get classmates:', error);
    res.status(500).json({ error: 'Failed to retrieve classmates' });
  }
});

/**
 * POST /api/student-passport/validate
 * Validate passport code (useful for frontend to check auth status)
 */
router.post('/validate', async (req, res) => {
  const { passportCode } = req.body;
  
  if (!passportCode) {
    return res.status(400).json({ error: 'Passport code required' });
  }
  
  try {
    // Use the same validation as our middleware
    const { data: studentData, error } = await supabaseAdmin
      .rpc('validate_student_login', { p_passport_code: passportCode })
      .single();
    
    if (error || !studentData) {
      return res.status(401).json({ 
        valid: false, 
        error: 'Invalid passport code' 
      });
    }
    
    res.json({
      valid: true,
      student: {
        id: studentData.student_id,
        name: studentData.student_name
      }
    });
  } catch (error) {
    logger.error('Failed to validate passport code:', error);
    res.status(500).json({ error: 'Validation service unavailable' });
  }
});

/**
 * GET /api/student-passport/dashboard
 * Get comprehensive dashboard data for the authenticated student
 */
router.get('/dashboard', requireStudentAuth, async (req, res) => {
  try {
    const student = req.student!;
    
    // Get student's detailed info with quiz results
    const { data: studentData, error: studentError } = await supabaseAdmin
      .from('students')
      .select(`
        id,
        student_name,
        grade_level,
        personality_type,
        learning_style,
        currency_balance,
        created_at,
        animal_types!animal_type_id (
          name,
          code,
          description
        ),
        genius_types!genius_type_id (
          name,
          code,
          description
        ),
        classes (
          id,
          name,
          subject,
          grade_level
        )
      `)
      .eq('id', student.id)
      .single();
    
    if (studentError || !studentData) {
      logger.error('Failed to fetch student data:', studentError);
      return res.status(500).json({ error: 'Failed to retrieve dashboard data' });
    }
    
    // Get quiz submission details if available
    const { data: quizData } = await supabaseAdmin
      .from('quiz_submissions')
      .select('personality_type, mbti_scores, learning_scores')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    // Calculate achievements (basic implementation)
    const achievements = [
      {
        id: 'quiz_complete',
        name: 'Quiz Champion',
        icon: '🌟',
        description: 'Completed the personality quiz',
        earned: true,
        earnedAt: studentData.created_at
      },
      {
        id: 'first_login', 
        name: 'First Login',
        icon: '🎯',
        description: 'Logged in for the first time',
        earned: true,
        earnedAt: studentData.created_at
      },
      {
        id: 'room_decorator',
        name: 'Room Decorator', 
        icon: '💎',
        description: 'Customize your room',
        earned: false,
        earnedAt: null
      },
      {
        id: 'social_butterfly',
        name: 'Social Butterfly',
        icon: '🏅', 
        description: 'Visit 5 classmate rooms',
        earned: false,
        earnedAt: null
      },
      {
        id: 'knowledge_seeker',
        name: 'Knowledge Seeker',
        icon: '🎪',
        description: 'Complete all learning activities', 
        earned: false,
        earnedAt: null
      },
      {
        id: 'leader',
        name: 'Leader',
        icon: '🚀',
        description: 'Earn top scores in class',
        earned: false,
        earnedAt: null
      }
    ];
    
    // Check if student has customized their room
    const { count: roomCustomizations } = await supabaseAdmin
      .from('student_inventory')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', student.id);
    
    if (roomCustomizations && roomCustomizations > 0) {
      const decoratorAchievement = achievements.find(a => a.id === 'room_decorator');
      if (decoratorAchievement) {
        decoratorAchievement.earned = true;
        decoratorAchievement.earnedAt = new Date().toISOString();
      }
    }
    
    res.json({
      student: {
        id: studentData.id,
        name: studentData.student_name,
        animalType: studentData.animal_types?.name || studentData.personality_type || 'Unknown',
        geniusType: studentData.genius_types?.name || '',
        passportCode: student.passportCode,
        classId: studentData.classes?.id || student.classId,
        className: studentData.classes?.name,
        gradeLevel: studentData.grade_level,
        coins: studentData.currency_balance || 0,
        createdAt: studentData.created_at,
        animalDetails: studentData.animal_types ? {
          name: studentData.animal_types.name,
          code: studentData.animal_types.code,
          description: studentData.animal_types.description
        } : null,
        geniusDetails: studentData.genius_types ? {
          name: studentData.genius_types.name,
          code: studentData.genius_types.code,
          description: studentData.genius_types.description
        } : null,
        quizResults: quizData ? {
          personalityType: quizData.personality_type,
          learningStyle: studentData.learning_style,
          scores: quizData.mbti_scores
        } : {
          personalityType: studentData.personality_type,
          learningStyle: studentData.learning_style || 'visual'
        }
      },
      achievements
    });
  } catch (error) {
    logger.error('Failed to get dashboard data:', error);
    res.status(500).json({ error: 'Failed to retrieve dashboard data' });
  }
});

/**
 * GET /api/student-passport/quiz-results
 * Get detailed quiz results for the authenticated student
 */
router.get('/quiz-results', requireStudentAuth, async (req, res) => {
  try {
    const student = req.student!;
    
    // Get student's detailed quiz results
    const { data: studentData, error: studentError } = await supabaseAdmin
      .from('students')
      .select(`
        id,
        student_name,
        animal_type,
        genius_type,
        personality_type,
        learning_style
      `)
      .eq('id', student.id)
      .single();
    
    if (studentError || !studentData) {
      logger.error('Failed to fetch student data:', studentError);
      return res.status(500).json({ error: 'Failed to retrieve quiz results' });
    }
    
    // Get detailed quiz submission data
    const { data: quizData, error: quizError } = await supabaseAdmin
      .from('quiz_submissions')
      .select('personality_type, mbti_scores, learning_scores, created_at')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (quizError || !quizData) {
      logger.error('Failed to fetch quiz submission:', quizError);
      return res.status(404).json({ error: 'Quiz results not found' });
    }
    
    res.json({
      student: {
        id: studentData.id,
        name: studentData.student_name,
        animalType: studentData.animal_type,
        geniusType: studentData.genius_type || '',
        personalityType: quizData.personality_type || studentData.personality_type,
        learningStyle: studentData.learning_style,
        scores: quizData.mbti_scores,
        learningScores: quizData.learning_scores
      }
    });
  } catch (error) {
    logger.error('Failed to get quiz results:', error);
    res.status(500).json({ error: 'Failed to retrieve quiz results' });
  }
});

/**
 * Example of optional auth - works for both authenticated and anonymous users
 */
router.get('/public-content', optionalStudentAuth, async (req, res) => {
  const content = {
    message: 'This is public content',
    personalizedMessage: req.student 
      ? `Hello ${req.student.name}! Welcome back.`
      : 'Hello anonymous visitor!'
  };
  
  res.json(content);
});

export default router;