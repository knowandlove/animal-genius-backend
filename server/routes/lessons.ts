import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { verifyClassAccess } from '../middleware/ownership-collaborator';
import { db } from '../db';
import { lessonProgress, lessonActivityProgress } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { lessons } from '../../shared/lessons';

const router = Router();

// GET /api/classes/:classId/lessons/progress
// Get all lesson progress for a class
router.get('/:classId/lessons/progress', requireAuth, verifyClassAccess, async (req, res) => {
  try {
    const { classId } = req.params;

    // Get all lesson progress for the class
    const progress = await db
      .select()
      .from(lessonProgress)
      .where(eq(lessonProgress.classId, classId));

    // Get activity progress for each lesson
    const progressWithActivities = await Promise.all(
      progress.map(async (lessonProg) => {
        const activities = await db
          .select()
          .from(lessonActivityProgress)
          .where(eq(lessonActivityProgress.lessonProgressId, lessonProg.id));

        return {
          ...lessonProg,
          activities,
        };
      })
    );

    // Calculate summary stats
    const totalLessons = lessons.length;
    const completedLessons = progress.filter(p => p.status === 'completed').length;
    const inProgressLessons = progress.filter(p => p.status === 'in_progress').length;

    res.json({
      lessons: progressWithActivities,
      totalLessons,
      completedLessons,
      inProgressLessons,
    });
  } catch (error) {
    console.error('Error fetching lesson progress:', error);
    res.status(500).json({ error: 'Failed to fetch lesson progress' });
  }
});

// GET /api/classes/:classId/lessons/:lessonId/progress
// Get specific lesson progress
router.get('/:classId/lessons/:lessonId/progress', requireAuth, verifyClassAccess, async (req, res) => {
  try {
    const { classId, lessonId } = req.params;

    // Get lesson progress
    const [progress] = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.classId, classId),
          eq(lessonProgress.lessonId, parseInt(lessonId))
        )
      );

    if (!progress) {
      return res.json({
        lessonId: parseInt(lessonId),
        status: 'not_started',
        currentActivity: 1,
        activities: [],
      });
    }

    // Get activity progress
    const activities = await db
      .select()
      .from(lessonActivityProgress)
      .where(eq(lessonActivityProgress.lessonProgressId, progress.id));

    res.json({
      ...progress,
      activities,
    });
  } catch (error) {
    console.error('Error fetching lesson progress:', error);
    res.status(500).json({ error: 'Failed to fetch lesson progress' });
  }
});

// POST /api/classes/:classId/lessons/:lessonId/start
// Start or resume a lesson
router.post('/:classId/lessons/:lessonId/start', requireAuth, verifyClassAccess, async (req, res) => {
  try {
    const { classId, lessonId } = req.params;
    const lessonIdNum = parseInt(lessonId);

    // Check if lesson already exists
    const [existing] = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.classId, classId),
          eq(lessonProgress.lessonId, lessonIdNum)
        )
      );

    if (existing) {
      // Update status if it was not_started
      if (existing.status === 'not_started') {
        await db
          .update(lessonProgress)
          .set({
            status: 'in_progress',
            startedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(lessonProgress.id, existing.id));
      }
      return res.json(existing);
    }

    // Create new lesson progress
    const [newProgress] = await db
      .insert(lessonProgress)
      .values({
        classId,
        lessonId: lessonIdNum,
        status: 'in_progress',
        currentActivity: 1,
        startedAt: new Date(),
      })
      .returning();

    res.json(newProgress);
  } catch (error) {
    console.error('Error starting lesson:', error);
    res.status(500).json({ error: 'Failed to start lesson' });
  }
});

// POST /api/classes/:classId/lessons/:lessonId/activities/:activityNumber/complete
// Mark an activity as complete
router.post('/:classId/lessons/:lessonId/activities/:activityNumber/complete', requireAuth, verifyClassAccess, async (req, res) => {
  try {
    const { classId, lessonId, activityNumber } = req.params;
    const lessonIdNum = parseInt(lessonId);
    const activityNum = parseInt(activityNumber);

    // Get or create lesson progress
    let [progress] = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.classId, classId),
          eq(lessonProgress.lessonId, lessonIdNum)
        )
      );

    if (!progress) {
      // Create lesson progress if it doesn't exist
      [progress] = await db
        .insert(lessonProgress)
        .values({
          classId,
          lessonId: lessonIdNum,
          status: 'in_progress',
          currentActivity: activityNum,
          startedAt: new Date(),
        })
        .returning();
    }

    // Check if activity already completed
    const [existingActivity] = await db
      .select()
      .from(lessonActivityProgress)
      .where(
        and(
          eq(lessonActivityProgress.lessonProgressId, progress.id),
          eq(lessonActivityProgress.activityNumber, activityNum)
        )
      );

    if (!existingActivity) {
      // Create activity progress
      await db
        .insert(lessonActivityProgress)
        .values({
          lessonProgressId: progress.id,
          activityNumber: activityNum,
          completed: true,
          completedAt: new Date(),
        });
    } else if (!existingActivity.completed) {
      // Update existing activity
      await db
        .update(lessonActivityProgress)
        .set({
          completed: true,
          completedAt: new Date(),
        })
        .where(eq(lessonActivityProgress.id, existingActivity.id));
    }

    // Update current activity if needed
    if (progress.currentActivity < activityNum + 1 && activityNum < 4) {
      await db
        .update(lessonProgress)
        .set({
          currentActivity: activityNum + 1,
          updatedAt: new Date(),
        })
        .where(eq(lessonProgress.id, progress.id));
    }

    // Check if all activities are complete
    const allActivities = await db
      .select()
      .from(lessonActivityProgress)
      .where(eq(lessonActivityProgress.lessonProgressId, progress.id));

    const completedCount = allActivities.filter(a => a.completed).length;
    
    // If all 4 activities are complete, mark lesson as complete
    if (completedCount >= 4 && progress.status !== 'completed') {
      await db
        .update(lessonProgress)
        .set({
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(lessonProgress.id, progress.id));
    }

    res.json({ success: true, completedActivities: completedCount });
  } catch (error) {
    console.error('Error completing activity:', error);
    res.status(500).json({ error: 'Failed to complete activity' });
  }
});

// POST /api/classes/:classId/lessons/:lessonId/complete
// Mark entire lesson as complete
router.post('/:classId/lessons/:lessonId/complete', requireAuth, verifyClassAccess, async (req, res) => {
  try {
    const { classId, lessonId } = req.params;
    const lessonIdNum = parseInt(lessonId);

    // Get or create lesson progress
    let [progress] = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.classId, classId),
          eq(lessonProgress.lessonId, lessonIdNum)
        )
      );

    if (!progress) {
      // Create lesson progress if it doesn't exist
      [progress] = await db
        .insert(lessonProgress)
        .values({
          classId,
          lessonId: lessonIdNum,
          status: 'completed',
          currentActivity: 4,
          startedAt: new Date(),
          completedAt: new Date(),
        })
        .returning();
    } else {
      // Update existing progress
      await db
        .update(lessonProgress)
        .set({
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(lessonProgress.id, progress.id));
    }

    // Mark all activities as complete
    for (let i = 1; i <= 4; i++) {
      const [existing] = await db
        .select()
        .from(lessonActivityProgress)
        .where(
          and(
            eq(lessonActivityProgress.lessonProgressId, progress.id),
            eq(lessonActivityProgress.activityNumber, i)
          )
        );

      if (!existing) {
        await db
          .insert(lessonActivityProgress)
          .values({
            lessonProgressId: progress.id,
            activityNumber: i,
            completed: true,
            completedAt: new Date(),
          });
      } else if (!existing.completed) {
        await db
          .update(lessonActivityProgress)
          .set({
            completed: true,
            completedAt: new Date(),
          })
          .where(eq(lessonActivityProgress.id, existing.id));
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error completing lesson:', error);
    res.status(500).json({ error: 'Failed to complete lesson' });
  }
});

export default router;