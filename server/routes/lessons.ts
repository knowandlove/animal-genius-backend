import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { verifyClassAccess } from '../middleware/ownership-collaborator';
import { db } from '../db';
import { lessonProgress, lessonActivityProgress, classValuesSessions, classes, classValuesVotes, classValuesResults } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
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
    if (progress.currentActivity !== null && progress.currentActivity < activityNum + 1 && activityNum < 4) {
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

// GET /api/classes/:classId/lessons/4/activity/2/status
// Check status of Activity 2 (Class Values Voting) for Lesson 4
router.get('/:classId/lessons/4/activity/2/status', requireAuth, verifyClassAccess, async (req, res) => {
  try {
    const { classId } = req.params;

    // Check if there's an active class values session for this class
    const [activeSession] = await db
      .select()
      .from(classValuesSessions)
      .where(
        and(
          eq(classValuesSessions.classId, classId),
          eq(classValuesSessions.status, 'active')
        )
      )
      .limit(1);

    // Check if Activity 2 is already complete
    const progress = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.classId, classId),
          eq(lessonProgress.lessonId, 4)
        )
      );

    let isComplete = false;
    if (progress.length > 0) {
      const activityProgress = await db
        .select()
        .from(lessonActivityProgress)
        .where(
          and(
            eq(lessonActivityProgress.lessonProgressId, progress[0].id),
            eq(lessonActivityProgress.activityNumber, 2)
          )
        );
      
      isComplete = activityProgress.length > 0 && activityProgress[0].completed === true;
    }

    res.json({
      hasActiveSession: !!activeSession,
      sessionId: activeSession?.id,
      expiresAt: activeSession?.expiresAt,
      isComplete
    });
  } catch (error) {
    console.error('Error checking activity 2 status:', error);
    res.status(500).json({ error: 'Failed to check activity status' });
  }
});

// POST /api/classes/:classId/lessons/4/activity/2/start-voting
// Start a class values voting session for Activity 2 of Lesson 4
router.post('/:classId/lessons/4/activity/2/start-voting', requireAuth, verifyClassAccess, async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = (req as any).user?.userId;

    // Get class info to get the class code
    const [classInfo] = await db
      .select()
      .from(classes)
      .where(eq(classes.id, classId))
      .limit(1);

    if (!classInfo) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Check if there's already an active session
    const [existingSession] = await db
      .select()
      .from(classValuesSessions)
      .where(
        and(
          eq(classValuesSessions.classId, classId),
          eq(classValuesSessions.status, 'active')
        )
      )
      .limit(1);

    if (existingSession) {
      // Return existing session info
      const votingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/class-values-voting/${existingSession.id}`;
      return res.json({
        sessionId: existingSession.id,
        votingUrl,
        expiresAt: existingSession.expiresAt
      });
    }

    // Create new voting session (15 minutes duration)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
    
    const [newSession] = await db
      .insert(classValuesSessions)
      .values({
        classId,
        startedBy: userId,
        status: 'active',
        startedAt: new Date(),
        expiresAt
      })
      .returning();

    // Mark lesson as in progress if not already
    const progress = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.classId, classId),
          eq(lessonProgress.lessonId, 4)
        )
      );

    if (progress.length === 0) {
      [progress[0]] = await db
        .insert(lessonProgress)
        .values({
          classId,
          lessonId: 4,
          status: 'in_progress',
          currentActivity: 2,
          startedAt: new Date(),
        })
        .returning();
    }

    const votingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/class-values-voting/${newSession.id}`;

    res.json({
      sessionId: newSession.id,
      votingUrl,
      expiresAt: newSession.expiresAt
    });
  } catch (error) {
    console.error('Error starting voting session:', error);
    res.status(500).json({ error: 'Failed to start voting session' });
  }
});

// POST /api/classes/:classId/lessons/4/activity/2/complete
// Complete Activity 2 (Class Values Voting) and finalize the session
router.post('/:classId/lessons/4/activity/2/complete', requireAuth, verifyClassAccess, async (req, res) => {
  try {
    const { classId } = req.params;
    const { sessionId } = req.body;

    // Finalize the voting session if provided
    if (sessionId) {
      // Get session and finalize it
      const [session] = await db
        .select()
        .from(classValuesSessions)
        .where(eq(classValuesSessions.id, sessionId))
        .limit(1);

      if (session && session.status === 'active') {
        // Calculate and save voting results 
        // Get all votes for this session
        console.log('🗳️ Fetching votes for sessionId:', sessionId);
        const votes = await db
          .select()
          .from(classValuesVotes)
          .where(eq(classValuesVotes.sessionId, sessionId));
        
        console.log('📊 Found votes:', votes.length);

        // Calculate vote counts for each value in each cluster
        const voteCounts = votes.reduce((acc, vote) => {
          const key = `${vote.clusterNumber}-${vote.valueCode}`;
          if (!acc[key]) {
            acc[key] = {
              clusterNumber: vote.clusterNumber,
              valueCode: vote.valueCode,
              valueName: vote.valueName,
              totalPoints: 0
            };
          }
          // Weight votes by rank (1st choice = 3 points, 2nd = 2 points, 3rd = 1 point)
          acc[key].totalPoints += (4 - vote.voteRank);
          return acc;
        }, {} as Record<string, any>);

        // Process results for each cluster and save winners
        const results: any[] = [];
        for (let clusterNum = 1; clusterNum <= 4; clusterNum++) {
          const clusterVotes = Object.values(voteCounts)
            .filter((v: any) => v.clusterNumber === clusterNum)
            .sort((a: any, b: any) => b.totalPoints - a.totalPoints);

          // Mark top 2 as winners and save all results
          for (let i = 0; i < clusterVotes.length; i++) {
            const result = clusterVotes[i];
            results.push({
              id: uuidv7(),
              classId,
              sessionId,
              clusterNumber: clusterNum,
              valueCode: result.valueCode,
              valueName: result.valueName,
              voteCount: result.totalPoints,
              isWinner: i < 2, // Top 2 are winners
            });
          }
        }

        // Insert results into database
        console.log('📊 Results calculated:', results.length, 'records');
        console.log('📋 Sample result:', results[0]);
        
        if (results.length > 0) {
          try {
            console.log('💾 Inserting results:', results.length, 'records');
            await db.insert(classValuesResults).values(results);
            console.log('✅ Results inserted successfully');
          } catch (dbError) {
            console.error('❌ Database insertion failed:', dbError);
            throw dbError;
          }
        } else {
          console.log('⚠️ No results to insert - votes array was:', votes.length);
        }
        
        // Mark session as completed
        await db
          .update(classValuesSessions)
          .set({
            status: 'completed',
            completedAt: new Date()
          })
          .where(eq(classValuesSessions.id, sessionId));

        // Mark class as having values set
        await db
          .update(classes)
          .set({
            hasValuesSet: true,
            valuesSetAt: new Date()
          })
          .where(eq(classes.id, classId));
      }
    }

    // Mark Activity 2 as complete using existing logic
    const lessonIdNum = 4;
    const activityNum = 2;

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
      // Update existing activity progress
      await db
        .update(lessonActivityProgress)
        .set({
          completed: true,
          completedAt: new Date(),
        })
        .where(eq(lessonActivityProgress.id, existingActivity.id));
    }

    // Update lesson progress
    await db
      .update(lessonProgress)
      .set({
        currentActivity: Math.max(progress.currentActivity ?? 1, activityNum),
        updatedAt: new Date(),
      })
      .where(eq(lessonProgress.id, progress.id));

    res.json({ 
      success: true,
      message: 'Activity 2 completed and class values voting session finalized'
    });
  } catch (error) {
    console.error('Error completing Activity 2:', error);
    res.status(500).json({ error: 'Failed to complete Activity 2' });
  }
});

export default router;