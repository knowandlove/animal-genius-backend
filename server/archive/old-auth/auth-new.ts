import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import {
  createClassroomSession,
  validateSessionCode,
  getClassStudents,
  generateClassActivations,
  activateStudent,
  studentLogin,
  getClassActivationSummary
} from '../services/authenticationService';

const router = Router();

// ===== TEACHER ENDPOINTS =====

/**
 * Start a classroom session
 * POST /api/auth/classroom/session
 */
const startSessionSchema = z.object({
  classId: z.string().uuid()
});

router.post('/classroom/session', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { classId } = startSessionSchema.parse(req.body);
    
    // Verify teacher owns this class
    const teacherId = (req as any).user.id;
    const teacherClass = await (req as any).db.query.classes.findFirst({
      where: (classes: any, { eq, and }: any) => and(
        eq(classes.id, classId),
        eq(classes.teacherId, teacherId)
      )
    });

    if (!teacherClass) {
      return res.status(403).json({ 
        success: false, 
        error: 'You do not have permission to start a session for this class' 
      });
    }

    const session = await createClassroomSession(classId, teacherId);

    res.json({
      success: true,
      data: {
        sessionCode: session.sessionCode,
        expiresAt: session.expiresAt,
        className: teacherClass.name
      }
    });
  } catch (error) {
    console.error('Start session error:', error);
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to start session' 
    });
  }
});

/**
 * Generate activation codes for the class
 * POST /api/auth/activations/generate
 */
const generateActivationsSchema = z.object({
  classId: z.string().uuid(),
  count: z.number().int().min(1).max(50)
});

router.post('/activations/generate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { classId, count } = generateActivationsSchema.parse(req.body);
    
    // Verify teacher owns this class
    const teacherId = (req as any).user.id;
    const teacherClass = await (req as any).db.query.classes.findFirst({
      where: (classes: any, { eq, and }: any) => and(
        eq(classes.id, classId),
        eq(classes.teacherId, teacherId)
      )
    });

    if (!teacherClass) {
      return res.status(403).json({ 
        success: false, 
        error: 'You do not have permission to generate activations for this class' 
      });
    }

    const activations = await generateClassActivations(classId, count);

    res.json({
      success: true,
      data: {
        activations: activations.map(a => ({
          code: a.activationCode,
          expiresAt: a.expiresAt
        })),
        count: activations.length
      }
    });
  } catch (error) {
    console.error('Generate activations error:', error);
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to generate activations' 
    });
  }
});

/**
 * Get class activation summary
 * GET /api/auth/classes/:classId/activation-summary
 */
router.get('/classes/:classId/activation-summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const classId = z.string().uuid().parse(req.params.classId);
    
    // Verify teacher owns this class
    const teacherId = (req as any).user.id;
    const teacherClass = await (req as any).db.query.classes.findFirst({
      where: (classes: any, { eq, and }: any) => and(
        eq(classes.id, classId),
        eq(classes.teacherId, teacherId)
      )
    });

    if (!teacherClass) {
      return res.status(403).json({ 
        success: false, 
        error: 'You do not have permission to view this class' 
      });
    }

    const summary = await getClassActivationSummary(classId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Get activation summary error:', error);
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get summary' 
    });
  }
});

// ===== STUDENT ENDPOINTS =====

/**
 * Validate classroom session code
 * POST /api/auth/classroom/validate
 */
const validateSessionSchema = z.object({
  sessionCode: z.string().transform(s => s.toUpperCase())
});

router.post('/classroom/validate', async (req: Request, res: Response) => {
  try {
    const { sessionCode } = validateSessionSchema.parse(req.body);
    const result = await validateSessionCode(sessionCode);

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired session code'
      });
    }

    res.json({
      success: true,
      data: {
        classId: result.classId,
        className: result.className
      }
    });
  } catch (error) {
    console.error('Validate session error:', error);
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to validate session' 
    });
  }
});

/**
 * Get students for visual picker
 * GET /api/auth/classroom/:classId/students
 */
router.get('/classroom/:classId/students', async (req: Request, res: Response) => {
  try {
    const classId = z.string().uuid().parse(req.params.classId);
    const students = await getClassStudents(classId);

    res.json({
      success: true,
      data: students
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get students' 
    });
  }
});

/**
 * Activate student account
 * POST /api/auth/activate
 */
const activateSchema = z.object({
  activationCode: z.string().transform(s => s.toUpperCase()),
  studentName: z.string().min(1).max(255),
  avatarId: z.string()
});

router.post('/activate', async (req: Request, res: Response) => {
  try {
    const data = activateSchema.parse(req.body);
    const result = await activateStudent(
      data.activationCode,
      data.studentName,
      data.avatarId
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: {
        studentId: result.student!.id,
        funCode: result.student!.funCode,
        avatarId: result.student!.avatarId
      }
    });
  } catch (error) {
    console.error('Activate student error:', error);
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to activate student' 
    });
  }
});

/**
 * Student login via visual picker
 * POST /api/auth/student/login
 */
const studentLoginSchema = z.object({
  funCode: z.string().transform(s => s.toUpperCase()),
  avatarId: z.string()
});

router.post('/student/login', async (req: Request, res: Response) => {
  try {
    const data = studentLoginSchema.parse(req.body);
    const result = await studentLogin(data.funCode, data.avatarId);

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: {
        token: result.token,
        student: {
          id: result.student!.id,
          name: result.student!.studentName,
          funCode: result.student!.funCode,
          avatarId: result.student!.avatarId,
          classId: result.student!.classId
        }
      }
    });
  } catch (error) {
    console.error('Student login error:', error);
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to login' 
    });
  }
});

export default router;