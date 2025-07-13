import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { verifyClassAccess } from '../middleware/ownership-collaborator';

const router = Router();

// GET /api/classes/:classId/lessons/progress
// Get lesson progress for a class (placeholder for now)
router.get('/:classId/lessons/progress', requireAuth, verifyClassAccess, async (req, res) => {
  try {
    // Return empty progress for now
    res.json({
      lessons: [],
      totalLessons: 0,
      completedLessons: 0,
      inProgressLessons: 0,
      message: "Lessons feature coming soon"
    });
  } catch (error) {
    console.error('Error fetching lesson progress:', error);
    res.status(500).json({ error: 'Failed to fetch lesson progress' });
  }
});

export default router;