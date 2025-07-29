import { Router } from 'express';
import { requireUnifiedAuth, requireStudent } from '../middleware/unified-auth';
import { pool } from '../db';

const router = Router();

/**
 * Save a game score
 * Requires student authentication
 */
router.post('/api/game-scores', requireUnifiedAuth, requireStudent, async (req, res) => {
  const client = await pool.connect();
  try {
    const { gameType, score, gameData = {} } = req.body;
    const studentId = req.student?.id!;
    const classId = req.student?.classId;

    // Validate input
    if (!gameType || typeof score !== 'number') {
      return res.status(400).json({ error: 'Game type and score are required' });
    }
    
    // Validate score to prevent cheating
    const MAX_SCORES_BY_GAME: Record<string, number> = {
      'fish_bubble_pop': 300, // Max ~5 points per second for 60 seconds
    };
    
    const maxScore = MAX_SCORES_BY_GAME[gameType] || 1000;
    
    if (score < 0 || score > maxScore || !Number.isInteger(score)) {
      console.warn(`Invalid score submission by student ${studentId}: game=${gameType}, score=${score}`);
      return res.status(400).json({ error: 'Invalid score submission' });
    }

    // Fallback to querying if classId not in session (for older sessions)
    let finalClassId = classId;
    if (!finalClassId) {
      const studentResult = await client.query(
        `SELECT class_id FROM students WHERE id = $1`,
        [studentId]
      );

      if (studentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      finalClassId = studentResult.rows[0].class_id;
    }

    // Insert the score
    const result = await client.query(
      `INSERT INTO game_scores (student_id, class_id, game_type, score, game_data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [studentId, finalClassId, gameType, score, gameData]
    );

    res.json({ 
      success: true, 
      scoreId: result.rows[0].id 
    });
  } catch (error) {
    console.error('Error saving game score:', error);
    res.status(500).json({ error: 'Failed to save game score' });
  } finally {
    client.release();
  }
});

/**
 * Get class leaderboard for a specific game
 * Can be accessed by authenticated students or via passport code
 */
router.get('/api/game-scores/leaderboard/:gameType', async (req, res) => {
  const client = await pool.connect();
  try {
    const { gameType } = req.params;
    const { passportCode, limit = 10 } = req.query;

    let classId: string;
    let currentStudentId: string | null = null;

    // Try to get class ID from authenticated student or passport code
    if (req.student?.id) {
      // If request has student auth from middleware
      currentStudentId = req.student.id;
      
      // Use classId from session if available, otherwise query
      if (req.student.classId) {
        classId = req.student.classId;
      } else {
        // Fallback for older sessions without classId
        const studentResult = await client.query(
          `SELECT class_id FROM students WHERE id = $1`,
          [currentStudentId]
        );
        
        if (studentResult.rows.length === 0) {
          return res.status(404).json({ error: 'Student not found' });
        }
        
        classId = studentResult.rows[0].class_id;
      }
    } else if (passportCode) {
      // Get class ID from passport code
      const studentResult = await client.query(
        `SELECT class_id FROM students WHERE passport_code = $1`,
        [passportCode]
      );
      
      if (studentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Invalid passport code' });
      }
      
      classId = studentResult.rows[0].class_id;
    } else {
      return res.status(400).json({ error: 'Authentication or passport code required' });
    }

    // Get top scores for the class
    const scoresResult = await client.query(
      `SELECT 
        gs.id,
        gs.score,
        gs.created_at,
        s.student_name,
        s.id as student_id,
        s.personality_type
      FROM game_scores gs
      JOIN students s ON gs.student_id = s.id
      WHERE gs.class_id = $1 AND gs.game_type = $2
      ORDER BY gs.score DESC, gs.created_at ASC
      LIMIT $3`,
      [classId, gameType, limit]
    );

    // Get personal best if authenticated
    let personalBest = null;
    if (currentStudentId) {
      const personalResult = await client.query(
        `SELECT score, created_at
         FROM game_scores
         WHERE student_id = $1 AND game_type = $2 AND class_id = $3
         ORDER BY score DESC
         LIMIT 1`,
        [currentStudentId, gameType, classId]
      );
      
      if (personalResult.rows.length > 0) {
        personalBest = personalResult.rows[0];
      }
    }

    res.json({
      leaderboard: scoresResult.rows.map((row, index) => ({
        rank: index + 1,
        studentId: row.student_id,
        studentName: row.student_name,
        score: row.score,
        personalityType: row.personality_type,
        isCurrentStudent: row.student_id === currentStudentId,
        date: row.created_at
      })),
      personalBest
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  } finally {
    client.release();
  }
});

/**
 * Get a student's game history
 * Requires student authentication
 */
router.get('/api/game-scores/history/:gameType', requireUnifiedAuth, requireStudent, async (req, res) => {
  const client = await pool.connect();
  try {
    const { gameType } = req.params;
    const studentId = req.student?.id!;

    const result = await client.query(
      `SELECT id, score, game_data, created_at
       FROM game_scores
       WHERE student_id = $1 AND game_type = $2
       ORDER BY created_at DESC
       LIMIT 20`,
      [studentId, gameType]
    );

    res.json({
      history: result.rows
    });
  } catch (error) {
    console.error('Error fetching game history:', error);
    res.status(500).json({ error: 'Failed to fetch game history' });
  } finally {
    client.release();
  }
});

export default router;