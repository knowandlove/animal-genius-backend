import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { uuidStorage } from '../storage-uuid';
import { lessons } from '@shared/lessons';

const router = Router();

// Get lesson progress for authenticated teacher
router.get('/progress', requireAuth, async (req: Request, res: Response) => {
  try {
    const teacherId = req.user!.userId;
    
    // Get all classes for this teacher
    const teacherClasses = await uuidStorage.getClassesByTeacherId(teacherId);
    
    // Get all students in these classes
    const allStudents = await Promise.all(
      teacherClasses.map(cls => uuidStorage.getStudentsByClassId(cls.id))
    );
    const studentIds = allStudents.flat().map(s => s.id);
    
    // Get progress for all these students
    const progressRecords = await Promise.all(
      studentIds.map(studentId => uuidStorage.getLessonProgressByStudent(studentId))
    );
    
    // Extract completed lesson IDs for the teacher's view
    const completedLessonIds = new Set<number>();
    progressRecords.flat().forEach(record => {
      if (record.isCompleted) {
        completedLessonIds.add(parseInt(record.lessonId));
      }
    });
    
    res.json(Array.from(completedLessonIds));
  } catch (error) {
    console.error('Get lesson progress error:', error);
    res.status(500).json({ message: 'Failed to get lesson progress' });
  }
});

// Mark lesson complete for teacher
router.post('/:lessonId/complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const teacherId = req.user!.userId;
    const lessonId = req.params.lessonId;
    
    // This is a teacher marking their own progress with a lesson
    // We'll create a special "teacher progress" record using the teacher's first class
    const teacherClasses = await uuidStorage.getClassesByTeacherId(teacherId);
    if (teacherClasses.length === 0) {
      return res.status(400).json({ message: 'No classes found for teacher' });
    }
    
    // Create a placeholder student for teacher progress
    const teacherStudent = await uuidStorage.upsertStudent({
      classId: teacherClasses[0].id,
      name: 'Teacher Progress'
    });
    
    // Mark lesson complete
    const progress = await uuidStorage.createOrUpdateLessonProgress({
      studentId: teacherStudent.id,
      lessonId,
      teacherId,
      isCompleted: true,
      score: null,
      completedAt: new Date()
    });
    
    res.json(progress);
  } catch (error) {
    console.error('Mark lesson complete error:', error);
    res.status(500).json({ message: 'Failed to mark lesson complete' });
  }
});

// Get lesson progress for a specific class
router.get('/classes/:classId/progress', requireAuth, async (req: Request, res: Response) => {
  try {
    const teacherId = req.user!.userId;
    const classId = req.params.classId;
    
    // Verify teacher owns the class
    const classRecord = await uuidStorage.getClassById(classId);
    if (!classRecord || classRecord.teacherId !== teacherId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Get all students in the class
    const students = await uuidStorage.getStudentsByClassId(classId);
    
    // Get progress for all students
    const progressRecords = await Promise.all(
      students.map(student => uuidStorage.getLessonProgressByStudent(student.id))
    );
    
    // Extract completed lesson IDs
    const completedLessonIds = new Set<number>();
    progressRecords.flat().forEach(record => {
      if (record.isCompleted) {
        completedLessonIds.add(parseInt(record.lessonId));
      }
    });
    
    res.json(Array.from(completedLessonIds));
  } catch (error) {
    console.error('Get class lesson progress error:', error);
    res.status(500).json({ message: 'Failed to get class lesson progress' });
  }
});

// Mark lesson complete for a class
router.post('/classes/:classId/:lessonId/complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const teacherId = req.user!.userId;
    const { classId, lessonId } = req.params;
    
    // Verify teacher owns the class
    const classRecord = await uuidStorage.getClassById(classId);
    if (!classRecord || classRecord.teacherId !== teacherId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Create a class-level progress record
    const classStudent = await uuidStorage.upsertStudent({
      classId,
      name: 'Class Progress'
    });
    
    // Mark lesson complete for the class
    const progress = await uuidStorage.createOrUpdateLessonProgress({
      studentId: classStudent.id,
      lessonId,
      teacherId,
      isCompleted: true,
      score: null,
      completedAt: new Date()
    });
    
    res.json(progress);
  } catch (error) {
    console.error('Mark class lesson complete error:', error);
    res.status(500).json({ message: 'Failed to mark class lesson complete' });
  }
});

// Get all lessons (static data)
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(lessons);
  } catch (error) {
    console.error('Get lessons error:', error);
    res.status(500).json({ message: 'Failed to get lessons' });
  }
});

export default router;