import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { verifyClassAccess } from '../middleware/ownership-collaborator';
import { db } from '../db';
import { lessonProgress, lessonActivityProgress, classValuesSessions, classes, classValuesVotes, classValuesResults, students, currencyTransactions, lessonFeedback, profiles } from '../../shared/schema';
import { eq, and, sql, desc, avg } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { lessons } from '../../shared/lessons';
import { CURRENCY_CONSTANTS, TRANSACTION_REASONS } from '../../shared/currency-types';

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
        id: uuidv7(),
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
          id: uuidv7(),
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
          id: uuidv7(),
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

    // Check if all activities are complete - re-fetch to get updated count
    const allActivities = await db
      .select()
      .from(lessonActivityProgress)
      .where(eq(lessonActivityProgress.lessonProgressId, progress.id));

    // Include the current activity we just marked complete
    const completedCount = allActivities.filter(a => a.completed).length;
    
    console.log(`Activity ${activityNum} completed. Total completed: ${completedCount}/4. Lesson status: ${progress.status}`);
    
    // If all 4 activities are complete, mark lesson as complete and award coins
    if (completedCount >= 4 && progress.status !== 'completed') {
      const userId = (req as any).user?.userId;
      
      // Use a transaction to ensure atomicity
      await db.transaction(async (tx) => {
        // Mark lesson as complete
        await tx
          .update(lessonProgress)
          .set({
            status: 'completed',
            completedAt: new Date(),
            coinsAwardedAt: new Date(), // Mark coins as awarded
            updatedAt: new Date(),
          })
          .where(eq(lessonProgress.id, progress.id));
        
        // Award coins only if not already awarded
        if (!progress.coinsAwardedAt) {
          // Get all active students in the class
          const activeStudents = await tx
            .select()
            .from(students)
            .where(eq(students.classId, classId));

          // Create currency transactions for each student
          const coinAmount = CURRENCY_CONSTANTS.LESSON_COMPLETION_REWARD;
          const transactionPromises = activeStudents.map(async (student) => {
            // Create transaction record
            await tx.insert(currencyTransactions).values({
              id: uuidv7(),
              studentId: student.id,
              amount: coinAmount,
              transactionType: 'lesson_complete',
              description: `${TRANSACTION_REASONS.LESSON_COMPLETE} - Lesson ${progress.lessonId}`,
              teacherId: userId,
              createdAt: new Date(),
            });

            // Update student balance
            await tx
              .update(students)
              .set({
                currencyBalance: student.currencyBalance + coinAmount,
                updatedAt: new Date(),
              })
              .where(eq(students.id, student.id));
          });

          await Promise.all(transactionPromises);
        }
      });
    }

    res.json({ success: true, completedActivities: completedCount });
  } catch (error) {
    console.error('Error completing activity:', error);
    res.status(500).json({ error: 'Failed to complete activity' });
  }
});

// POST /api/classes/:classId/lessons/:lessonId/complete
// Mark entire lesson as complete and award coins to all students
router.post('/:classId/lessons/:lessonId/complete', requireAuth, verifyClassAccess, async (req, res) => {
  try {
    const { classId, lessonId } = req.params;
    const lessonIdNum = parseInt(lessonId);
    const userId = (req as any).user?.userId;

    // Validate lessonId
    if (isNaN(lessonIdNum) || lessonIdNum < 1 || lessonIdNum > 4) {
      return res.status(400).json({ error: 'Invalid lesson ID. Must be between 1 and 4' });
    }

    // Start a database transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Get or create lesson progress
      let [progress] = await tx
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
        [progress] = await tx
          .insert(lessonProgress)
          .values({
            id: uuidv7(),
            classId,
            lessonId: lessonIdNum,
            status: 'completed',
            currentActivity: 4,
            startedAt: new Date(),
            completedAt: new Date(),
            coinsAwardedAt: new Date(), // Mark coins as awarded immediately
          })
          .returning();
      } else {
        // Check if coins have already been awarded
        if (progress.coinsAwardedAt) {
          // Coins already awarded, just update the status
          await tx
            .update(lessonProgress)
            .set({
              status: 'completed',
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(lessonProgress.id, progress.id));
        } else {
          // Update existing progress and mark coins as awarded
          await tx
            .update(lessonProgress)
            .set({
              status: 'completed',
              completedAt: new Date(),
              coinsAwardedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(lessonProgress.id, progress.id));
        }
      }

      // Mark all activities as complete
      for (let i = 1; i <= 4; i++) {
        const [existing] = await tx
          .select()
          .from(lessonActivityProgress)
          .where(
            and(
              eq(lessonActivityProgress.lessonProgressId, progress.id),
              eq(lessonActivityProgress.activityNumber, i)
            )
          );

        if (!existing) {
          await tx
            .insert(lessonActivityProgress)
            .values({
              id: uuidv7(),
              lessonProgressId: progress.id,
              activityNumber: i,
              completed: true,
              completedAt: new Date(),
            });
        } else if (!existing.completed) {
          await tx
            .update(lessonActivityProgress)
            .set({
              completed: true,
              completedAt: new Date(),
            })
            .where(eq(lessonActivityProgress.id, existing.id));
        }
      }

      // Award coins only if not already awarded
      if (!progress.coinsAwardedAt) {
        // Get all active students in the class
        const activeStudents = await tx
          .select()
          .from(students)
          .where(eq(students.classId, classId));

        // Create currency transactions for each student
        const coinAmount = CURRENCY_CONSTANTS.LESSON_COMPLETION_REWARD;
        const transactionPromises = activeStudents.map(async (student) => {
          // Create transaction record
          await tx.insert(currencyTransactions).values({
            id: uuidv7(),
            studentId: student.id,
            amount: coinAmount,
            transactionType: 'lesson_complete',
            description: `${TRANSACTION_REASONS.LESSON_COMPLETE} - Lesson ${lessonIdNum}`,
            teacherId: userId,
            createdAt: new Date(),
          });

          // Update student balance
          await tx
            .update(students)
            .set({
              currencyBalance: student.currencyBalance + coinAmount,
              updatedAt: new Date(),
            })
            .where(eq(students.id, student.id));
        });

        await Promise.all(transactionPromises);
      }
    });

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
          id: uuidv7(),
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
          id: uuidv7(),
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
          id: uuidv7(),
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

// POST /api/classes/:classId/lessons/:lessonId/reset
// Reset lesson progress (but keep coins with students)
router.post('/:classId/lessons/:lessonId/reset', requireAuth, verifyClassAccess, async (req, res) => {
  try {
    const { classId, lessonId } = req.params;
    const lessonIdNum = parseInt(lessonId);

    // Get lesson progress
    const [progress] = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.classId, classId),
          eq(lessonProgress.lessonId, lessonIdNum)
        )
      );

    if (!progress) {
      return res.status(404).json({ error: 'Lesson progress not found' });
    }

    // Start a transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Reset lesson progress to in_progress
      // Note: We do NOT reset coinsAwardedAt - students keep their coins
      await tx
        .update(lessonProgress)
        .set({
          status: 'in_progress',
          completedAt: null,
          currentActivity: 1,
          updatedAt: new Date(),
        })
        .where(eq(lessonProgress.id, progress.id));

      // Delete all activity progress for this lesson
      await tx
        .delete(lessonActivityProgress)
        .where(eq(lessonActivityProgress.lessonProgressId, progress.id));
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error resetting lesson:', error);
    res.status(500).json({ error: 'Failed to reset lesson' });
  }
});

// POST /api/classes/:classId/lessons/:lessonId/activities/:activityNumber/reset
// Reset specific activity progress
router.post('/:classId/lessons/:lessonId/activities/:activityNumber/reset', requireAuth, verifyClassAccess, async (req, res) => {
  try {
    const { classId, lessonId, activityNumber } = req.params;
    const lessonIdNum = parseInt(lessonId);
    const activityNum = parseInt(activityNumber);

    // Get lesson progress
    const [progress] = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.classId, classId),
          eq(lessonProgress.lessonId, lessonIdNum)
        )
      );

    if (!progress) {
      return res.status(404).json({ error: 'Lesson progress not found' });
    }

    // Start a transaction
    await db.transaction(async (tx) => {
      // Delete the activity progress
      await tx
        .delete(lessonActivityProgress)
        .where(
          and(
            eq(lessonActivityProgress.lessonProgressId, progress.id),
            eq(lessonActivityProgress.activityNumber, activityNum)
          )
        );

      // If lesson was completed, change it back to in_progress
      if (progress.status === 'completed') {
        await tx
          .update(lessonProgress)
          .set({
            status: 'in_progress',
            completedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(lessonProgress.id, progress.id));
      }

      // Update current activity if needed
      if (progress.currentActivity && progress.currentActivity > activityNum) {
        await tx
          .update(lessonProgress)
          .set({
            currentActivity: activityNum,
            updatedAt: new Date(),
          })
          .where(eq(lessonProgress.id, progress.id));
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error resetting activity:', error);
    res.status(500).json({ error: 'Failed to reset activity' });
  }
});

// POST /api/lessons/:lessonId/feedback
// Create or update lesson feedback
router.post('/lessons/:lessonId/feedback', requireAuth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { rating, comment } = req.body;
    const teacherId = (req as any).user?.userId;
    
    console.log('Feedback endpoint hit:', { lessonId, rating, comment, teacherId });

    // Validate input
    const lessonIdNum = parseInt(lessonId);
    if (isNaN(lessonIdNum) || lessonIdNum < 1 || lessonIdNum > 4) {
      return res.status(400).json({ error: 'Invalid lesson ID. Must be between 1 and 4' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    if (comment && comment.length > 1000) {
      return res.status(400).json({ error: 'Comment must be 1000 characters or less' });
    }

    // Sanitize comment (remove HTML tags)
    const sanitizedComment = comment ? comment.replace(/<[^>]*>/g, '') : null;

    // Use UPSERT logic - insert or update if exists
    const existingFeedback = await db
      .select()
      .from(lessonFeedback)
      .where(
        and(
          eq(lessonFeedback.teacherId, teacherId),
          eq(lessonFeedback.lessonId, lessonIdNum)
        )
      )
      .limit(1);

    let result;
    if (existingFeedback.length > 0) {
      // Update existing feedback
      [result] = await db
        .update(lessonFeedback)
        .set({
          rating,
          comment: sanitizedComment,
          updatedAt: new Date(),
        })
        .where(eq(lessonFeedback.id, existingFeedback[0].id))
        .returning();
    } else {
      // Create new feedback
      [result] = await db
        .insert(lessonFeedback)
        .values({
          id: uuidv7(),
          lessonId: lessonIdNum,
          teacherId,
          rating,
          comment: sanitizedComment,
        })
        .returning();
    }

    res.json(result);
  } catch (error) {
    console.error('Error saving lesson feedback:', error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// GET /api/lessons/:lessonId/my-feedback
// Get current teacher's feedback for a lesson
router.get('/lessons/:lessonId/my-feedback', requireAuth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const teacherId = (req as any).user?.userId;

    // Validate lessonId
    const lessonIdNum = parseInt(lessonId);
    if (isNaN(lessonIdNum) || lessonIdNum < 1 || lessonIdNum > 4) {
      return res.status(400).json({ error: 'Invalid lesson ID. Must be between 1 and 4' });
    }

    const [feedback] = await db
      .select()
      .from(lessonFeedback)
      .where(
        and(
          eq(lessonFeedback.teacherId, teacherId),
          eq(lessonFeedback.lessonId, lessonIdNum)
        )
      );

    res.json(feedback || null);
  } catch (error) {
    console.error('Error fetching lesson feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// GET /api/admin/feedback/summary
// Get overall feedback statistics (admin only)
router.get('/admin/feedback/summary', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check if user is admin
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, user.userId));

    if (!profile?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get overall statistics
    const overallStats = await db
      .select({
        totalFeedback: sql<number>`count(*)::int`,
        averageRating: sql<number>`avg(${lessonFeedback.rating})::float`,
        uniqueTeachers: sql<number>`count(distinct ${lessonFeedback.teacherId})::int`,
      })
      .from(lessonFeedback);

    // Get per-lesson statistics
    const perLessonStats = await db
      .select({
        lessonId: lessonFeedback.lessonId,
        totalFeedback: sql<number>`count(*)::int`,
        averageRating: sql<number>`avg(${lessonFeedback.rating})::float`,
        latestFeedback: sql<Date>`max(${lessonFeedback.updatedAt})`,
      })
      .from(lessonFeedback)
      .groupBy(lessonFeedback.lessonId)
      .orderBy(lessonFeedback.lessonId);

    // Get recent feedback trend (last 30 days)
    const recentTrend = await db
      .select({
        date: sql<string>`date_trunc('day', ${lessonFeedback.createdAt})::date`,
        count: sql<number>`count(*)::int`,
        averageRating: sql<number>`avg(${lessonFeedback.rating})::float`,
      })
      .from(lessonFeedback)
      .where(
        sql`${lessonFeedback.createdAt} >= current_date - interval '30 days'`
      )
      .groupBy(sql`date_trunc('day', ${lessonFeedback.createdAt})`)
      .orderBy(sql`date_trunc('day', ${lessonFeedback.createdAt})`);

    res.json({
      overall: overallStats[0] || { totalFeedback: 0, averageRating: 0, uniqueTeachers: 0 },
      perLesson: perLessonStats,
      recentTrend,
    });
  } catch (error) {
    console.error('Error fetching feedback summary:', error);
    res.status(500).json({ error: 'Failed to fetch feedback summary' });
  }
});

// GET /api/admin/feedback/lessons/:lessonId
// Get all feedback for a specific lesson (admin only)
router.get('/admin/feedback/lessons/:lessonId', requireAuth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const user = (req as any).user;
    
    // Validate lessonId
    const lessonIdNum = parseInt(lessonId);
    if (isNaN(lessonIdNum) || lessonIdNum < 1 || lessonIdNum > 4) {
      return res.status(400).json({ error: 'Invalid lesson ID. Must be between 1 and 4' });
    }
    
    // Check if user is admin
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, user.userId));

    if (!profile?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get all feedback for the lesson with teacher details
    const feedbackList = await db
      .select({
        id: lessonFeedback.id,
        rating: lessonFeedback.rating,
        comment: lessonFeedback.comment,
        createdAt: lessonFeedback.createdAt,
        updatedAt: lessonFeedback.updatedAt,
        teacher: {
          id: profiles.id,
          fullName: profiles.fullName,
          email: profiles.email,
          schoolOrganization: profiles.schoolOrganization,
        },
      })
      .from(lessonFeedback)
      .innerJoin(profiles, eq(lessonFeedback.teacherId, profiles.id))
      .where(eq(lessonFeedback.lessonId, lessonIdNum))
      .orderBy(desc(lessonFeedback.updatedAt));

    // Get aggregated stats for this lesson
    const [stats] = await db
      .select({
        totalFeedback: sql<number>`count(*)::int`,
        averageRating: sql<number>`avg(${lessonFeedback.rating})::float`,
        distribution: sql<any>`
          json_build_object(
            '1', count(*) filter (where rating = 1),
            '2', count(*) filter (where rating = 2),
            '3', count(*) filter (where rating = 3),
            '4', count(*) filter (where rating = 4),
            '5', count(*) filter (where rating = 5)
          )
        `,
      })
      .from(lessonFeedback)
      .where(eq(lessonFeedback.lessonId, lessonIdNum));

    res.json({
      lessonId: lessonIdNum,
      stats: stats || { totalFeedback: 0, averageRating: 0, distribution: {} },
      feedback: feedbackList,
    });
  } catch (error) {
    console.error('Error fetching lesson feedback details:', error);
    res.status(500).json({ error: 'Failed to fetch lesson feedback' });
  }
});

export default router;