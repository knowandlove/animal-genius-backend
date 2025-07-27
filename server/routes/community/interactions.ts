import express from 'express';
import { z } from 'zod';
import { db } from '../../db.js';
import { interactions, replies, discussions } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createSecureLogger } from '../../utils/secure-logger.js';
import type { Request, Response } from 'express';

const logger = createSecureLogger('CommunityInteractions');
const router = express.Router();

// Validation schemas
const createInteractionSchema = z.object({
  type: z.enum(['viewed', 'helpful', 'saved', 'tried_it', 'shared']),
  discussionId: z.string().uuid().optional(),
  replyId: z.string().uuid().optional(),
  metadata: z.object({
    workedForMe: z.boolean().optional(),
    modifications: z.string().optional(),
  }).optional(),
}).refine(data => data.discussionId || data.replyId, {
  message: 'Either discussionId or replyId must be provided',
});

const getInteractionsSchema = z.object({
  type: z.enum(['viewed', 'helpful', 'saved', 'tried_it', 'shared']).optional(),
});

const deleteInteractionSchema = z.object({
  type: z.enum(['viewed', 'helpful', 'saved', 'tried_it', 'shared']),
  discussionId: z.string().uuid().optional(),
  replyId: z.string().uuid().optional(),
}).refine(data => data.discussionId || data.replyId, {
  message: 'Either discussionId or replyId must be provided',
});

// Toggle interaction (create or remove)
router.post('/', async (req: Request, res: Response) => {
  try {
    const validatedData = createInteractionSchema.parse(req.body);
    const teacherId = req.user!.userId;

    // Validate that the discussion/reply exists
    if (validatedData.discussionId) {
      const [discussion] = await db.select()
        .from(discussions)
        .where(eq(discussions.id, validatedData.discussionId));
      
      if (!discussion) {
        return res.status(404).json({ error: 'Discussion not found' });
      }
    }

    if (validatedData.replyId) {
      const [reply] = await db.select()
        .from(replies)
        .where(eq(replies.id, validatedData.replyId));
      
      if (!reply) {
        return res.status(404).json({ error: 'Reply not found' });
      }
    }

    // Check if interaction already exists
    const whereConditions = [
      eq(interactions.teacherId, teacherId),
      eq(interactions.type, validatedData.type),
    ];
    
    if (validatedData.discussionId) {
      whereConditions.push(eq(interactions.discussionId, validatedData.discussionId));
    }
    if (validatedData.replyId) {
      whereConditions.push(eq(interactions.replyId, validatedData.replyId));
    }

    const [existingInteraction] = await db.select()
      .from(interactions)
      .where(and(...whereConditions));

    let action: 'created' | 'removed';

    if (existingInteraction) {
      // Remove the interaction
      await db.delete(interactions)
        .where(eq(interactions.id, existingInteraction.id));
      
      // Update counts for replies if needed
      if (validatedData.type === 'helpful' && validatedData.replyId) {
        await db.update(replies)
          .set({ helpfulCount: sql`GREATEST(helpful_count - 1, 0)` })
          .where(eq(replies.id, validatedData.replyId));
      }
      
      action = 'removed';
    } else {
      // Create the interaction
      await db.insert(interactions).values({
        teacherId,
        discussionId: validatedData.discussionId,
        replyId: validatedData.replyId,
        type: validatedData.type,
        metadata: validatedData.metadata || {},
      });

      // Update counts for replies if needed
      if (validatedData.type === 'helpful' && validatedData.replyId) {
        await db.update(replies)
          .set({ helpfulCount: sql`helpful_count + 1` })
          .where(eq(replies.id, validatedData.replyId));
      }
      
      action = 'created';
    }

    logger.info('Interaction toggled', { 
      action,
      type: validatedData.type,
      teacherId 
    });

    res.json({ action, created: action === 'created' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    logger.error('Failed to toggle interaction', error);
    res.status(500).json({ error: 'Failed to toggle interaction' });
  }
});

// Get user's interactions
router.get('/mine', async (req: Request, res: Response) => {
  try {
    const params = getInteractionsSchema.parse(req.query);
    const teacherId = req.user!.userId;

    let results;
    if (params.type) {
      results = await db.select({
        interaction: interactions,
        discussion: discussions,
        reply: replies,
      })
      .from(interactions)
      .leftJoin(discussions, eq(interactions.discussionId, discussions.id))
      .leftJoin(replies, eq(interactions.replyId, replies.id))
      .where(and(
        eq(interactions.teacherId, teacherId),
        eq(interactions.type, params.type)
      ))
      .orderBy(interactions.createdAt);
    } else {
      results = await db.select({
        interaction: interactions,
        discussion: discussions,
        reply: replies,
      })
      .from(interactions)
      .leftJoin(discussions, eq(interactions.discussionId, discussions.id))
      .leftJoin(replies, eq(interactions.replyId, replies.id))
      .where(eq(interactions.teacherId, teacherId))
      .orderBy(interactions.createdAt);
    }

    // Group by type
    const groupedInteractions = results.reduce((acc, { interaction, discussion, reply }) => {
      if (!acc[interaction.type]) {
        acc[interaction.type] = [];
      }
      acc[interaction.type].push({
        ...interaction,
        discussion: discussion || undefined,
        reply: reply || undefined,
      });
      return acc;
    }, {} as Record<string, any[]>);

    res.json(groupedInteractions);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    logger.error('Failed to get interactions', error);
    res.status(500).json({ error: 'Failed to get interactions' });
  }
});

// Remove interaction
router.delete('/', async (req: Request, res: Response) => {
  try {
    const { type, discussionId, replyId } = deleteInteractionSchema.parse(req.body);
    const teacherId = req.user!.userId;

    const whereConditions = [
      eq(interactions.teacherId, teacherId),
      eq(interactions.type, type),
    ];

    if (discussionId) {
      whereConditions.push(eq(interactions.discussionId, discussionId));
    }
    if (replyId) {
      whereConditions.push(eq(interactions.replyId, replyId));
    }

    const deleted = await db.delete(interactions)
      .where(and(...whereConditions))
      .returning();

    // Update helpful count if applicable
    if (type === 'helpful' && replyId && deleted.length > 0) {
      await db.update(replies)
        .set({ helpfulCount: sql`GREATEST(helpful_count - 1, 0)` })
        .where(eq(replies.id, replyId));
    }

    res.json({ message: 'Interaction removed successfully' });
  } catch (error) {
    logger.error('Failed to remove interaction', error);
    res.status(500).json({ error: 'Failed to remove interaction' });
  }
});

// Get user's interactions for a specific discussion
router.get('/discussion/:discussionId', async (req: Request, res: Response) => {
  try {
    const discussionId = req.params.discussionId;
    const teacherId = req.user!.userId;
    
    // Get all interactions for this user and discussion
    const userInteractions = await db.select({
      type: interactions.type,
    })
    .from(interactions)
    .where(and(
      eq(interactions.teacherId, teacherId),
      eq(interactions.discussionId, discussionId)
    ));
    
    // Convert to a map of interaction types
    const interactionMap = {
      viewed: false,
      helpful: false,
      saved: false,
      tried_it: false,
      shared: false,
    };
    
    userInteractions.forEach(interaction => {
      interactionMap[interaction.type as keyof typeof interactionMap] = true;
    });
    
    res.json(interactionMap);
  } catch (error) {
    logger.error('Failed to get user interactions', error);
    res.status(500).json({ error: 'Failed to get user interactions' });
  }
});

export default router;