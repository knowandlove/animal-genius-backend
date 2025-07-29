import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { classes, students, classValuesSessions, classValuesVotes, classValuesResults } from '../../shared/schema';
import { CORE_VALUE_CLUSTERS, isValidValueCode, getValueByCode, getClusterById } from '../../shared/core-values-constants';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { requireUnifiedAuth, requireStudent } from '../middleware/unified-auth';
import { requireStudentAuth } from '../middleware/passport-auth';
import { v7 as uuidv7 } from 'uuid';

const router = Router();

// Schema for starting a values session
const startSessionSchema = z.object({
  classId: z.string().uuid(),
});

// Schema for student voting
const submitVotesSchema = z.object({
  sessionId: z.string().uuid(),
  votes: z.array(z.object({
    clusterNumber: z.number().min(1).max(4),
    values: z.array(z.object({
      valueCode: z.string(),
      rank: z.number().min(1).max(3),
    })).length(3), // Must vote for exactly 3 values per cluster
  })).length(4), // Must vote for all 4 clusters
});

// GET /api/class-values/clusters - Get all value clusters and options
router.get('/clusters', async (req, res) => {
  try {
    res.json({
      clusters: CORE_VALUE_CLUSTERS,
    });
  } catch (error) {
    console.error('Error fetching clusters:', error);
    res.status(500).json({ error: 'Failed to fetch value clusters' });
  }
});

// POST /api/class-values/start-session - Teacher starts a voting session
router.post('/start-session', requireAuth, async (req, res) => {
  try {
    const { classId } = startSessionSchema.parse(req.body);
    const teacherId = req.user!.userId;

    // Verify teacher owns this class
    const classData = await db
      .select()
      .from(classes)
      .where(and(
        eq(classes.id, classId),
        eq(classes.teacherId, teacherId),
        sql`${classes.deletedAt} IS NULL`
      ))
      .limit(1);

    if (classData.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Check if there's already an active session
    const activeSession = await db
      .select()
      .from(classValuesSessions)
      .where(and(
        eq(classValuesSessions.classId, classId),
        eq(classValuesSessions.status, 'active'),
        sql`${classValuesSessions.expiresAt} > NOW()`
      ))
      .limit(1);

    if (activeSession.length > 0) {
      return res.status(400).json({ 
        error: 'There is already an active voting session for this class',
        sessionId: activeSession[0].id 
      });
    }

    // Create new session with 2 hour expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);
    
    const newSession = await db
      .insert(classValuesSessions)
      .values({
        id: uuidv7(),
        classId,
        startedBy: teacherId,
        status: 'active',
        expiresAt,
      })
      .returning();

    res.json({
      message: 'Values voting session started successfully',
      session: newSession[0],
    });
  } catch (error) {
    console.error('Error starting session:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('duplicate key')) {
        return res.status(400).json({ 
          error: 'A voting session is already active for this class' 
        });
      }
      if (error.message.includes('foreign key')) {
        return res.status(400).json({ 
          error: 'Invalid class or teacher data' 
        });
      }
      // Log the full error for debugging
      console.error('Full error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to start voting session',
      details: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : undefined
    });
  }
});

// GET /api/class-values/session/:classCode - Get active session for a class (by class code)
router.get('/session/:classCode', async (req, res) => {
  try {
    const { classCode } = req.params;

    // Find class by code
    const classData = await db
      .select()
      .from(classes)
      .where(and(
        eq(classes.classCode, classCode),
        sql`${classes.deletedAt} IS NULL`
      ))
      .limit(1);

    if (classData.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Get active session
    const session = await db
      .select({
        id: classValuesSessions.id,
        status: classValuesSessions.status,
        startedAt: classValuesSessions.startedAt,
        expiresAt: classValuesSessions.expiresAt,
      })
      .from(classValuesSessions)
      .where(and(
        eq(classValuesSessions.classId, classData[0].id),
        eq(classValuesSessions.status, 'active')
      ))
      .limit(1);

    if (session.length === 0) {
      return res.status(404).json({ error: 'No active voting session for this class' });
    }

    res.json({
      session: session[0],
      classInfo: {
        name: classData[0].name,
        id: classData[0].id,
      },
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch voting session' });
  }
});

// GET /api/class-values/session-by-id/:sessionId - Get session info by sessionId (for students)
router.get('/session-by-id/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Find session by ID
    const session = await db
      .select({
        id: classValuesSessions.id,
        classId: classValuesSessions.classId,
        status: classValuesSessions.status,
        expiresAt: classValuesSessions.expiresAt,
      })
      .from(classValuesSessions)
      .where(eq(classValuesSessions.id, sessionId))
      .limit(1);

    if (session.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get class info
    const classData = await db
      .select({
        name: classes.name,
        id: classes.id,
      })
      .from(classes)
      .where(eq(classes.id, session[0].classId))
      .limit(1);

    res.json({
      id: session[0].id,
      classId: session[0].classId,
      status: session[0].status,
      expiresAt: session[0].expiresAt,
      className: classData[0]?.name,
    });
  } catch (error) {
    console.error('Error fetching session by ID:', error);
    res.status(500).json({ error: 'Failed to fetch voting session' });
  }
});

// POST /api/class-values/extend-session/:sessionId - Extend session time by 15 minutes
router.post('/extend-session/:sessionId', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Find session by ID
    const session = await db
      .select()
      .from(classValuesSessions)
      .where(eq(classValuesSessions.id, sessionId))
      .limit(1);

    if (session.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session[0].status !== 'active') {
      return res.status(400).json({ error: 'Can only extend active sessions' });
    }

    if (!session[0].expiresAt) {
      return res.status(500).json({ error: 'Active session has no expiration time' });
    }

    // Extend by 15 minutes from current expiration time
    const newExpiresAt = new Date(session[0].expiresAt);
    newExpiresAt.setMinutes(newExpiresAt.getMinutes() + 15);

    // Update the session
    await db
      .update(classValuesSessions)
      .set({ expiresAt: newExpiresAt })
      .where(eq(classValuesSessions.id, sessionId));

    res.json({
      sessionId: session[0].id,
      expiresAt: newExpiresAt,
      message: 'Session extended by 15 minutes'
    });

  } catch (error) {
    console.error('Error extending session:', error);
    res.status(500).json({ error: 'Failed to extend session' });
  }
});

// POST /api/class-values/reset-session/:sessionId - Reset session and delete all votes
router.post('/reset-session/:sessionId', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Find session by ID
    const session = await db
      .select()
      .from(classValuesSessions)
      .where(eq(classValuesSessions.id, sessionId))
      .limit(1);

    if (session.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify teacher owns this session's class
    const classData = await db
      .select()
      .from(classes)
      .where(eq(classes.id, session[0].classId))
      .limit(1);

    if (classData.length === 0 || classData[0].teacherId !== req.user!.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Delete all votes for this session
    await db
      .delete(classValuesVotes)
      .where(eq(classValuesVotes.sessionId, sessionId));

    // Delete all results for this class
    await db
      .delete(classValuesResults)
      .where(eq(classValuesResults.classId, session[0].classId));

    // Reset class hasValuesSet flag
    await db
      .update(classes)
      .set({
        hasValuesSet: false,
        valuesSetAt: sql`NULL`
      })
      .where(eq(classes.id, session[0].classId));

    // Reset session to active with new expiration time (15 minutes from now)
    const newExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await db
      .update(classValuesSessions)
      .set({ 
        status: 'active',
        expiresAt: newExpiresAt 
      })
      .where(eq(classValuesSessions.id, sessionId));

    res.json({
      sessionId: session[0].id,
      expiresAt: newExpiresAt,
      message: 'Session reset successfully - all votes cleared'
    });

  } catch (error) {
    console.error('Error resetting session:', error);
    res.status(500).json({ error: 'Failed to reset session' });
  }
});

// POST /api/class-values/vote - Student submits their votes
router.post('/vote', requireStudentAuth, async (req, res) => {
  try {
    console.log('Vote submission received:', {
      body: req.body,
      votesCount: req.body.votes?.length,
      studentId: req.student?.id
    });
    
    const { sessionId, votes } = submitVotesSchema.parse(req.body);
    const studentId = req.student!.id; // From passport authentication

    // Verify session is active
    const session = await db
      .select()
      .from(classValuesSessions)
      .where(and(
        eq(classValuesSessions.id, sessionId),
        eq(classValuesSessions.status, 'active')
      ))
      .limit(1);

    if (session.length === 0) {
      return res.status(404).json({ error: 'Voting session not found or not active' });
    }

    // Verify student belongs to the class (student already verified by passport auth)
    if (req.student!.classId !== session[0].classId) {
      return res.status(403).json({ error: 'Student does not belong to this class' });
    }

    // Check if student already voted
    const existingVotes = await db
      .select()
      .from(classValuesVotes)
      .where(and(
        eq(classValuesVotes.sessionId, sessionId),
        eq(classValuesVotes.studentId, studentId)
      ))
      .limit(1);

    if (existingVotes.length > 0) {
      return res.status(400).json({ error: 'You have already voted in this session' });
    }

    // Validate all votes
    for (const clusterVote of votes) {
      for (const value of clusterVote.values) {
        // Check if the value code is valid and belongs to the correct cluster
        const valueInfo = getValueByCode(value.valueCode);
        if (!valueInfo || valueInfo.clusterId !== clusterVote.clusterNumber) {
          return res.status(400).json({ 
            error: `Invalid value code ${value.valueCode} for cluster ${clusterVote.clusterNumber}` 
          });
        }
      }
    }

    // Insert all votes in a transaction for atomicity
    await db.transaction(async (tx) => {
      const voteRecords = [];
      
      // Validate we have exactly 3 votes per cluster
      for (const clusterVote of votes) {
        if (clusterVote.values.length !== 3) {
          throw new Error(`Each cluster must have exactly 3 votes. Cluster ${clusterVote.clusterNumber} has ${clusterVote.values.length}`);
        }
        
        // Check for duplicate ranks within cluster
        const ranks = clusterVote.values.map(v => v.rank);
        if (new Set(ranks).size !== ranks.length) {
          throw new Error(`Duplicate ranks found in cluster ${clusterVote.clusterNumber}`);
        }
      }
      
      // Build vote records
      for (const clusterVote of votes) {
        for (const value of clusterVote.values) {
          const coreValueInfo = getValueByCode(value.valueCode);
          if (coreValueInfo) {
            voteRecords.push({
              id: uuidv7(),
              sessionId,
              studentId,
              clusterNumber: clusterVote.clusterNumber,
              valueCode: value.valueCode,
              valueName: coreValueInfo.value.displayName,
              voteRank: value.rank,
            });
          }
        }
      }
      
      // Insert all votes atomically
      await tx.insert(classValuesVotes).values(voteRecords);
    });

    res.json({
      message: 'Votes submitted successfully',
      votesCount: votes.length * 3, // 3 votes per cluster
    });
  } catch (error) {
    console.error('Error submitting votes:', error);
    
    // Handle specific error cases
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid vote data', 
        details: error.errors 
      });
    }
    
    if (error instanceof Error) {
      // Handle transaction errors
      if (error.message.includes('exactly 3 votes')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('Duplicate ranks')) {
        return res.status(400).json({ error: error.message });
      }
      
      // Handle database constraint violations
      if ('code' in error) {
        if (error.code === '23505') { // Unique constraint violation
          return res.status(400).json({ 
            error: 'You have already submitted votes for this session' 
          });
        }
        if (error.code === '23503') { // Foreign key violation
          return res.status(400).json({ 
            error: 'Invalid session or student data' 
          });
        }
      }
    }
    
    res.status(500).json({ error: 'Failed to submit votes' });
  }
});

// GET /api/class-values/progress/:sessionId - Get voting progress
router.get('/progress/:sessionId', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get session with class info
    const sessionData = await db
      .select({
        session: classValuesSessions,
        class: classes,
      })
      .from(classValuesSessions)
      .innerJoin(classes, eq(classValuesSessions.classId, classes.id))
      .where(eq(classValuesSessions.id, sessionId))
      .limit(1);

    if (sessionData.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify teacher owns this class
    if (sessionData[0].class.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get total students in class
    const totalStudents = await db
      .select({ count: sql<number>`count(*)` })
      .from(students)
      .where(eq(students.classId, sessionData[0].class.id));

    // Get students who have voted
    const votedStudents = await db
      .select({ 
        studentId: classValuesVotes.studentId,
      })
      .from(classValuesVotes)
      .where(eq(classValuesVotes.sessionId, sessionId))
      .groupBy(classValuesVotes.studentId);

    const total = Number(totalStudents[0].count);
    const voted = votedStudents.length;
    const percentage = total > 0 ? Math.round((voted / total) * 100) : 0;
    const votedStudentIds = votedStudents.map(v => v.studentId);

    res.json({
      session: sessionData[0].session,
      progress: {
        totalStudents: total,
        studentsVoted: voted,
        completionPercentage: percentage,
      },
      status: sessionData[0].session.status,
      votedStudentIds,
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Failed to fetch voting progress' });
  }
});

// POST /api/class-values/finalize/:sessionId - Finalize voting and calculate results
router.post('/finalize/:sessionId', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get session with class info
    const sessionData = await db
      .select({
        session: classValuesSessions,
        class: classes,
      })
      .from(classValuesSessions)
      .innerJoin(classes, eq(classValuesSessions.classId, classes.id))
      .where(and(
        eq(classValuesSessions.id, sessionId),
        eq(classValuesSessions.status, 'active')
      ))
      .limit(1);

    if (sessionData.length === 0) {
      return res.status(404).json({ error: 'Active session not found' });
    }

    // Verify teacher owns this class
    if (sessionData[0].class.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const classId = sessionData[0].class.id;

    // Calculate vote counts for each value in each cluster
    const voteCounts = await db
      .select({
        clusterNumber: classValuesVotes.clusterNumber,
        valueCode: classValuesVotes.valueCode,
        valueName: classValuesVotes.valueName,
        // Weight votes by rank (1st choice = 3 points, 2nd = 2 points, 3rd = 1 point)
        totalPoints: sql<number>`sum(4 - ${classValuesVotes.voteRank})`,
      })
      .from(classValuesVotes)
      .where(eq(classValuesVotes.sessionId, sessionId))
      .groupBy(
        classValuesVotes.clusterNumber, 
        classValuesVotes.valueCode,
        classValuesVotes.valueName
      );

    // Process results for each cluster
    const results: any[] = [];
    for (let clusterNum = 1; clusterNum <= 4; clusterNum++) {
      const clusterVotes = voteCounts
        .filter(v => v.clusterNumber === clusterNum)
        .sort((a, b) => Number(b.totalPoints) - Number(a.totalPoints));

      // Mark top 2 as winners
      for (let i = 0; i < clusterVotes.length; i++) {
        results.push({
          id: uuidv7(),
          classId,
          sessionId,
          clusterNumber: clusterNum,
          valueCode: clusterVotes[i].valueCode,
          valueName: clusterVotes[i].valueName,
          voteCount: Number(clusterVotes[i].totalPoints),
          isWinner: i < 2, // Top 2 are winners
        });
      }
    }

    // Use transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Insert results
      if (results.length > 0) {
        await tx.insert(classValuesResults).values(results);
      }

      // Update session status
      await tx
        .update(classValuesSessions)
        .set({
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(classValuesSessions.id, sessionId));

      // Update class to indicate values have been set
      await tx
        .update(classes)
        .set({
          hasValuesSet: true,
          valuesSetAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(classes.id, classId));
    });

    // Get the winning values
    const winners = results.filter(r => r.isWinner);

    res.json({
      message: 'Voting finalized successfully',
      results: winners,
    });
  } catch (error) {
    console.error('Error finalizing votes:', error);
    
    // Handle specific error cases
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: error.errors 
      });
    }
    
    if (error instanceof Error && 'code' in error) {
      // Handle database constraint violations
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({ 
          error: 'This voting session has already been finalized' 
        });
      }
      if (error.code === '23503') { // Foreign key violation
        return res.status(400).json({ 
          error: 'Invalid session data' 
        });
      }
    }
    
    res.status(500).json({ error: 'Failed to finalize voting' });
  }
});

// GET /api/class-values/results/:classId - Get class values results
router.get('/results/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    console.log('🚀 RESULTS ENDPOINT HIT! classId:', classId);
    console.log('🔍 Fetching results for classId:', classId);

    // Get class info
    const classData = await db
      .select()
      .from(classes)
      .where(and(
        eq(classes.id, classId),
        eq(classes.hasValuesSet, true)
      ))
      .limit(1);

    if (classData.length === 0) {
      return res.status(404).json({ error: 'Class not found or values not set' });
    }

    // Get winning values
    console.log('🔍 Querying results for classId:', classId);
    const allResults = await db
      .select()
      .from(classValuesResults)
      .where(eq(classValuesResults.classId, classId));
    
    console.log('📊 All results found:', allResults.length);
    
    const results = allResults.filter(r => r.isWinner);
    console.log('🏆 Winning results:', results.length);

    // Format results by cluster
    const formattedResults = [];
    for (let i = 1; i <= 4; i++) {
      const clusterResults = results.filter(r => r.clusterNumber === i);
      const cluster = CORE_VALUE_CLUSTERS.find(c => c.id === i);
      
      if (cluster && clusterResults.length > 0) {
        formattedResults.push({
          clusterId: i,
          clusterTitle: cluster.title,
          clusterPrompt: cluster.prompt,
          values: clusterResults.map(r => ({
            code: r.valueCode,
            name: r.valueName,
          })),
        });
      }
    }

    res.json({
      className: classData[0].name,
      valuesSetAt: classData[0].valuesSetAt,
      values: formattedResults,
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Failed to fetch class values' });
  }
});

// GET /api/class-values/check-voted/:sessionId - Check if student has voted
router.get('/check-voted/:sessionId', requireStudentAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const studentId = req.student!.id; // From passport authentication

    const votes = await db
      .select({ id: classValuesVotes.id })
      .from(classValuesVotes)
      .where(and(
        eq(classValuesVotes.sessionId, sessionId),
        eq(classValuesVotes.studentId, studentId)
      ))
      .limit(1);

    res.json({
      hasVoted: votes.length > 0,
    });
  } catch (error) {
    console.error('Error checking vote status:', error);
    res.status(500).json({ error: 'Failed to check vote status' });
  }
});

// POST /api/class-values/cleanup-sessions - Development helper to clean up active sessions
router.post('/cleanup-sessions', requireAuth, async (req, res) => {
  // Only allow admin users in development mode
  if (process.env.NODE_ENV !== 'development' || !req.user?.isAdmin) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    console.log('🧹 Cleaning up active sessions...');
    
    // Get active sessions first
    const activeSessions = await db
      .select()
      .from(classValuesSessions)
      .where(eq(classValuesSessions.status, 'active'));

    console.log(`Found ${activeSessions.length} active sessions`);

    if (activeSessions.length > 0) {
      // Update them to completed
      const result = await db
        .update(classValuesSessions)
        .set({ 
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(classValuesSessions.status, 'active'))
        .returning();

      console.log(`✅ Cleaned up ${result.length} sessions`);
      
      res.json({
        message: `Cleaned up ${result.length} active sessions`,
        cleanedSessions: result.length
      });
    } else {
      res.json({
        message: 'No active sessions to clean up',
        cleanedSessions: 0
      });
    }
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
    res.status(500).json({ error: 'Failed to clean up sessions' });
  }
});

export default router;
