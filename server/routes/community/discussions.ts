import express from 'express';
import { z } from 'zod';
import { db } from '../../db.js';
import { discussions, discussionTags, tags, profiles, replies, interactions } from '@shared/schema';
import { eq, desc, and, inArray, sql, or, ilike } from 'drizzle-orm';
import { createSecureLogger } from '../../utils/secure-logger.js';
import type { Request, Response } from 'express';

const logger = createSecureLogger('CommunityDiscussions');
const router = express.Router();

// Validation schemas
const createDiscussionSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1),
  category: z.enum(['lessons', 'animals', 'challenges', 'success_stories', 'ask_teachers', 'feedback']),
  tagIds: z.array(z.string().uuid()).default([]),
});

const updateDiscussionSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  body: z.string().min(1).optional(),
  status: z.enum(['active', 'resolved', 'archived']).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

const listDiscussionsSchema = z.object({
  category: z.enum(['lessons', 'animals', 'challenges', 'success_stories', 'ask_teachers', 'feedback']).optional(),
  tags: z.array(z.string()).optional(),
  grade: z.string().optional(),
  sort: z.enum(['recent', 'trending', 'helpful', 'unanswered']).optional().default('recent'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(10),
  search: z.string().optional(),
});

// Create a new discussion
router.post('/', async (req: Request, res: Response) => {
  try {
    const validatedData = createDiscussionSchema.parse(req.body);
    const teacherId = req.user!.userId;

    // Start transaction
    const result = await db.transaction(async (tx) => {
      // Create the discussion
      const [discussion] = await tx.insert(discussions).values({
        teacherId,
        title: validatedData.title,
        body: validatedData.body,
        category: validatedData.category,
      }).returning();

      // Link tags
      if (validatedData.tagIds.length > 0) {
        await tx.insert(discussionTags).values(
          validatedData.tagIds.map(tagId => ({
            discussionId: discussion.id,
            tagId,
          }))
        );

        // Increment usage count for tags
        await tx.update(tags)
          .set({ usageCount: sql`usage_count + 1` })
          .where(inArray(tags.id, validatedData.tagIds));
      }

      return discussion;
    });

    logger.info('Discussion created', { discussionId: result.id, teacherId });
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    logger.error('Failed to create discussion', error);
    res.status(500).json({ error: 'Failed to create discussion' });
  }
});

// List discussions with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const params = listDiscussionsSchema.parse(req.query);
    const offset = (params.page - 1) * params.limit;

    // Build where conditions
    const whereConditions = [];
    
    // ALWAYS filter out archived discussions
    whereConditions.push(eq(discussions.status, 'active'));
    
    if (params.category) {
      whereConditions.push(eq(discussions.category, params.category));
    }

    if (params.search) {
      whereConditions.push(
        or(
          ilike(discussions.title, `%${params.search}%`),
          ilike(discussions.body, `%${params.search}%`)
        )
      );
    }

    // Base query
    let query = db.select({
      discussion: discussions,
      teacher: {
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        personalityAnimal: profiles.personalityAnimal,
      },
      replyCount: sql<number>`(
        SELECT COUNT(*)::int FROM replies
        WHERE replies.discussion_id = discussions.id
      )`,
      helpfulCount: sql<number>`(
        SELECT COUNT(*)::int FROM interactions
        WHERE interactions.discussion_id = discussions.id
        AND interactions.type = 'helpful'
      )`,
      triedCount: sql<number>`(
        SELECT COUNT(*)::int FROM interactions
        WHERE interactions.discussion_id = discussions.id
        AND interactions.type = 'tried_it'
      )`,
    })
    .from(discussions)
    .leftJoin(profiles, eq(discussions.teacherId, profiles.id))
    .where(and(...whereConditions))
    .limit(params.limit)
    .offset(offset);

    // Apply sorting
    let orderedQuery;
    switch (params.sort) {
      case 'trending':
        orderedQuery = query.orderBy(desc(discussions.viewCount), desc(discussions.createdAt));
        break;
      case 'helpful':
        orderedQuery = query.orderBy(sql`helpful_count DESC`, desc(discussions.createdAt));
        break;
      case 'unanswered':
        orderedQuery = query.orderBy(sql`reply_count ASC`, desc(discussions.createdAt));
        break;
      default:
        orderedQuery = query.orderBy(desc(discussions.createdAt));
    }

    const results = await orderedQuery;

    // Get tags for all discussions in a single query (if we have results)
    let tagsByDiscussion: Record<string, typeof tags.$inferSelect[]> = {};
    
    if (results.length > 0) {
      const discussionIds = results.map(r => r.discussion.id);
      const tagsData = await db.select({
        discussionId: discussionTags.discussionId,
        tag: tags,
      })
      .from(discussionTags)
      .leftJoin(tags, eq(discussionTags.tagId, tags.id))
      .where(inArray(discussionTags.discussionId, discussionIds));

      // Group tags by discussion
      tagsByDiscussion = tagsData.reduce((acc, item) => {
        if (!acc[item.discussionId]) {
          acc[item.discussionId] = [];
        }
        if (item.tag) {
          acc[item.discussionId].push(item.tag);
        }
        return acc;
      }, {} as Record<string, typeof tags.$inferSelect[]>);
    }

    // Format response
    const formattedResults = results.map(({ discussion, teacher, replyCount, helpfulCount, triedCount }) => ({
      ...discussion,
      teacher,
      tags: tagsByDiscussion[discussion.id] || [],
      replyCount,
      helpfulCount,
      triedCount,
    }));

    // Get total count for pagination
    const [{ count }] = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(discussions)
      .where(and(...whereConditions));

    res.json({
      discussions: formattedResults,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: count,
        totalPages: Math.ceil(count / params.limit),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    logger.error('Failed to list discussions', error);
    res.status(500).json({ error: 'Failed to list discussions' });
  }
});

// Get single discussion with replies
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const discussionId = req.params.id;
    logger.info('Getting discussion with replies', { discussionId, userId: req.user?.userId });

    // Get discussion with teacher info and counts
    const [discussionData] = await db.select({
      discussion: discussions,
      teacher: {
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        personalityAnimal: profiles.personalityAnimal,
        schoolOrganization: profiles.schoolOrganization,
      },
      helpfulCount: sql<number>`(
        SELECT COUNT(*)::int FROM interactions
        WHERE interactions.discussion_id = discussions.id
        AND interactions.type = 'helpful'
      )`,
      triedCount: sql<number>`(
        SELECT COUNT(*)::int FROM interactions
        WHERE interactions.discussion_id = discussions.id
        AND interactions.type = 'tried_it'
      )`,
    })
    .from(discussions)
    .leftJoin(profiles, eq(discussions.teacherId, profiles.id))
    .where(eq(discussions.id, discussionId));

    if (!discussionData) {
      return res.status(404).json({ error: 'Discussion not found' });
    }

    // Check if discussion is archived
    if (discussionData.discussion.status === 'archived') {
      return res.status(404).json({ error: 'Discussion not found' });
    }

    // Get tags
    const tagsData = await db.select({ tag: tags })
      .from(discussionTags)
      .leftJoin(tags, eq(discussionTags.tagId, tags.id))
      .where(eq(discussionTags.discussionId, discussionId));

    // Get replies with teacher info
    logger.info('Fetching replies for discussion', { discussionId });
    
    // First, let's check if there are any replies at all
    const rawReplyCount = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(replies)
      .where(eq(replies.discussionId, discussionId));
    
    logger.info('Raw reply count in database', { 
      discussionId, 
      count: rawReplyCount[0].count 
    });
    
    const repliesData = await db.select()
    .from(replies)
    .leftJoin(profiles, eq(replies.teacherId, profiles.id))
    .where(eq(replies.discussionId, discussionId))
    .orderBy(desc(replies.isAcceptedAnswer), desc(replies.helpfulCount), replies.createdAt);
    
    logger.info('Replies fetched with joins', { 
      discussionId, 
      replyCount: repliesData.length,
      replies: repliesData.map(r => ({ 
        id: r.replies.id, 
        body: r.replies.body?.substring(0, 50),
        teacherId: r.replies.teacherId,
        hasTeacher: !!r.profiles
      }))
    });

    // Track view interaction and increment view count only for new views
    const viewResult = await db.insert(interactions).values({
      teacherId: req.user!.userId,
      discussionId,
      type: 'viewed',
    }).onConflictDoNothing().returning();

    // If this is a new view (not a conflict), increment the view count
    if (viewResult.length > 0) {
      await db.update(discussions)
        .set({ viewCount: sql`view_count + 1` })
        .where(eq(discussions.id, discussionId));
    }

    // Build response
    const formattedReplies = repliesData.map(row => ({
      ...row.replies,
      teacher: row.profiles ? {
        id: row.profiles.id,
        firstName: row.profiles.firstName,
        lastName: row.profiles.lastName,
        personalityAnimal: row.profiles.personalityAnimal,
      } : null,
    }));
    
    const response = {
      ...discussionData.discussion,
      teacher: discussionData.teacher,
      helpfulCount: discussionData.helpfulCount,
      triedCount: discussionData.triedCount,
      tags: tagsData.map(t => t.tag).filter(Boolean),
      replies: formattedReplies,
    };
    
    logger.info('Sending discussion response', { 
      discussionId,
      hasReplies: response.replies.length > 0,
      replyCount: response.replies.length,
      firstReply: response.replies[0] ? {
        id: response.replies[0].id,
        hasBody: !!response.replies[0].body,
        hasTeacher: !!response.replies[0].teacher
      } : null
    });
    
    res.json(response);
  } catch (error) {
    logger.error('Failed to get discussion', { 
      error: error.message, 
      stack: error.stack,
      discussionId: req.params.id 
    });
    res.status(500).json({ error: 'Failed to get discussion' });
  }
});

// Update discussion (author only)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const discussionId = req.params.id;
    const validatedData = updateDiscussionSchema.parse(req.body);
    const teacherId = req.user!.userId;

    // Check ownership
    const [existing] = await db.select()
      .from(discussions)
      .where(eq(discussions.id, discussionId));

    if (!existing) {
      return res.status(404).json({ error: 'Discussion not found' });
    }

    if (existing.teacherId !== teacherId) {
      return res.status(403).json({ error: 'You can only edit your own discussions' });
    }

    // Update discussion
    const result = await db.transaction(async (tx) => {
      const [updated] = await tx.update(discussions)
        .set({
          title: validatedData.title,
          body: validatedData.body,
          status: validatedData.status,
          updatedAt: new Date(),
        })
        .where(eq(discussions.id, discussionId))
        .returning();

      // Update tags if provided
      if (validatedData.tagIds) {
        // Remove old tags
        await tx.delete(discussionTags)
          .where(eq(discussionTags.discussionId, discussionId));

        // Add new tags
        if (validatedData.tagIds.length > 0) {
          await tx.insert(discussionTags).values(
            validatedData.tagIds.map(tagId => ({
              discussionId,
              tagId,
            }))
          );
        }
      }

      return updated;
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    logger.error('Failed to update discussion', error);
    res.status(500).json({ error: 'Failed to update discussion' });
  }
});

// Delete discussion (soft delete, author only)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const discussionId = req.params.id;
    const teacherId = req.user!.userId;

    // Check ownership
    const [existing] = await db.select()
      .from(discussions)
      .where(eq(discussions.id, discussionId));

    if (!existing) {
      return res.status(404).json({ error: 'Discussion not found' });
    }

    if (existing.teacherId !== teacherId) {
      return res.status(403).json({ error: 'You can only delete your own discussions' });
    }

    // Soft delete by setting status to archived WITH ownership check
    const result = await db.update(discussions)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(and(
        eq(discussions.id, discussionId),
        eq(discussions.teacherId, teacherId) // Double-check ownership in query
      ))
      .returning();

    if (result.length === 0) {
      return res.status(403).json({ error: 'Failed to delete discussion - unauthorized' });
    }

    logger.info('Discussion archived', { discussionId, teacherId });
    res.json({ message: 'Discussion archived successfully', discussion: result[0] });
  } catch (error) {
    logger.error('Failed to delete discussion', error);
    res.status(500).json({ error: 'Failed to delete discussion' });
  }
});

// DEBUG ENDPOINT - Remove in production  
router.get('/debug/:discussionId/test', async (req: Request, res: Response) => {
  try {
    const discussionId = req.params.discussionId;
    
    // Test the exact same query as the main endpoint
    const repliesData = await db.select()
      .from(replies)
      .leftJoin(profiles, eq(replies.teacherId, profiles.id))
      .where(eq(replies.discussionId, discussionId))
      .orderBy(desc(replies.isAcceptedAnswer), desc(replies.helpfulCount), replies.createdAt);
    
    // Format exactly as in main endpoint
    const formattedReplies = repliesData.map(row => ({
      ...row.replies,
      teacher: row.profiles ? {
        id: row.profiles.id,
        firstName: row.profiles.firstName,
        lastName: row.profiles.lastName,
        personalityAnimal: row.profiles.personalityAnimal,
      } : null,
    }));
    
    res.json({
      discussionId,
      rawCount: repliesData.length,
      formattedCount: formattedReplies.length,
      firstRawReply: repliesData[0] ? {
        hasRepliesKey: 'replies' in repliesData[0],
        hasProfilesKey: 'profiles' in repliesData[0],
        replyId: repliesData[0].replies?.id,
      } : null,
      firstFormattedReply: formattedReplies[0] || null,
      allFormattedReplies: formattedReplies
    });
  } catch (error) {
    logger.error('Debug endpoint error', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;