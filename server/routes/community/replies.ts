import express from 'express';
import { z } from "zod";
import { db } from '../../db.js';
import { replies, discussions, interactions } from '@shared/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { createSecureLogger } from '../../utils/secure-logger.js';
import type { Request, Response } from 'express';

const _logger = createSecureLogger('CommunityReplies');
const router = express.Router();

// Validation schemas
const createReplySchema = z.object({
  body: z.string().min(1),
  parentReplyId: z.string().uuid().optional(),
});

const updateReplySchema = z.object({
  body: z.string().min(1),
});

// Add reply to discussion
router.post('/:discussionId', async (req: Request, res: Response) => {
  try {
    const discussionId = req.params.discussionId;
    const validatedData = createReplySchema.parse(req.body);
    const teacherId = req.user!.userId;

    logger.info('Creating reply', { discussionId, teacherId, body: validatedData.body.substring(0, 50) });

    // Check if discussion exists and is not archived
    const [discussion] = await db.select()
      .from(discussions)
      .where(and(
        eq(discussions.id, discussionId),
        eq(discussions.status, 'active')
      ));

    if (!discussion) {
      logger.warn('Discussion not found or archived', { discussionId });
      return res.status(404).json({ error: 'Discussion not found or has been archived' });
    }

    // Check if parent reply exists and belongs to same discussion
    if (validatedData.parentReplyId) {
      const [parentReply] = await db.select()
        .from(replies)
        .where(eq(replies.id, validatedData.parentReplyId));

      if (!parentReply || parentReply.discussionId !== discussionId) {
        return res.status(400).json({ error: 'Invalid parent reply' });
      }

      // Check nesting level (max 2 levels)
      if (parentReply.parentReplyId) {
        return res.status(400).json({ error: 'Maximum nesting level reached' });
      }
    }

    // Create reply
    const result = await db.insert(replies).values({
      discussionId,
      parentReplyId: validatedData.parentReplyId,
      teacherId,
      body: validatedData.body,
    }).returning();
    
    if (!result || result.length === 0) {
      logger.error('Reply insert failed - no result returned');
      return res.status(500).json({ error: 'Failed to create reply' });
    }
    
    const reply = result[0];

    // Verify the reply was actually created
    const [verifyReply] = await db.select()
      .from(replies)
      .where(eq(replies.id, reply.id));
    
    if (!verifyReply) {
      logger.error('Reply verification failed - reply not found after insert', { replyId: reply.id });
      return res.status(500).json({ error: 'Reply creation failed' });
    }

    logger.info('Reply created and verified', { 
      replyId: reply.id, 
      discussionId, 
      teacherId,
      verified: true 
    });
    
    res.status(201).json(reply);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    logger.error('Failed to create reply', error);
    res.status(500).json({ error: 'Failed to create reply' });
  }
});

// Update reply (author only)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const replyId = req.params.id;
    const validatedData = updateReplySchema.parse(req.body);
    const teacherId = req.user!.userId;

    // Check ownership
    const [existing] = await db.select()
      .from(replies)
      .where(eq(replies.id, replyId));

    if (!existing) {
      return res.status(404).json({ error: 'Reply not found' });
    }

    if (existing.teacherId !== teacherId) {
      return res.status(403).json({ error: 'You can only edit your own replies' });
    }

    // Update reply
    const [updated] = await db.update(replies)
      .set({
        body: validatedData.body,
        updatedAt: new Date(),
      })
      .where(eq(replies.id, replyId))
      .returning();

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    logger.error('Failed to update reply', error);
    res.status(500).json({ error: 'Failed to update reply' });
  }
});

// Mark reply as accepted answer (discussion author only)
router.put('/:id/accept', async (req: Request, res: Response) => {
  try {
    const replyId = req.params.id;
    const teacherId = req.user!.userId;

    // Get reply with discussion info
    const [replyData] = await db.select({
      reply: replies,
      discussionTeacherId: discussions.teacherId,
    })
    .from(replies)
    .leftJoin(discussions, eq(replies.discussionId, discussions.id))
    .where(eq(replies.id, replyId));

    if (!replyData) {
      return res.status(404).json({ error: 'Reply not found' });
    }

    // Only discussion author can mark accepted answer
    if (replyData.discussionTeacherId !== teacherId) {
      return res.status(403).json({ error: 'Only discussion author can mark accepted answers' });
    }

    // Unmark any existing accepted answer
    await db.update(replies)
      .set({ isAcceptedAnswer: false })
      .where(and(
        eq(replies.discussionId, replyData.reply.discussionId),
        eq(replies.isAcceptedAnswer, true)
      ));

    // Mark this reply as accepted
    const [updated] = await db.update(replies)
      .set({ isAcceptedAnswer: true })
      .where(eq(replies.id, replyId))
      .returning();

    res.json(updated);
  } catch (error) {
    logger.error('Failed to mark accepted answer', error);
    res.status(500).json({ error: 'Failed to mark accepted answer' });
  }
});

// Delete reply (soft delete by clearing content, author only)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const replyId = req.params.id;
    const teacherId = req.user!.userId;

    // Check ownership
    const [existing] = await db.select()
      .from(replies)
      .where(eq(replies.id, replyId));

    if (!existing) {
      return res.status(404).json({ error: 'Reply not found' });
    }

    if (existing.teacherId !== teacherId) {
      return res.status(403).json({ error: 'You can only delete your own replies' });
    }

    // Check if reply has children
    const [hasChildren] = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(replies)
      .where(eq(replies.parentReplyId, replyId));

    if (hasChildren.count > 0) {
      // Soft delete - just update the body
      await db.update(replies)
        .set({ 
          body: '[This reply has been deleted]',
          updatedAt: new Date(),
        })
        .where(eq(replies.id, replyId));
    } else {
      // Hard delete if no children
      await db.delete(replies)
        .where(eq(replies.id, replyId));
    }

    res.json({ message: 'Reply deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete reply', error);
    res.status(500).json({ error: 'Failed to delete reply' });
  }
});

export default router;