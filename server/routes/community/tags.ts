import express from 'express';
import { z } from "zod";
import { db } from '../../db.js';
import { tags } from '@shared/schema';
import { eq, ilike, desc, and, inArray } from 'drizzle-orm';
import { createSecureLogger } from '../../utils/secure-logger.js';
import type { Request, Response } from 'express';

const logger = createSecureLogger('CommunityTags');
const router = express.Router();

// Validation schemas
const searchTagsSchema = z.object({
  q: z.string().min(1),
  category: z.enum(['grade', 'animal_mix', 'challenge_type', 'class_dynamic', 'time_of_year']).optional(),
  limit: z.coerce.number().int().positive().max(20).optional().default(10),
});

const suggestTagsSchema = z.object({
  title: z.string(),
  body: z.string(),
});

// Helper function to generate slug
function generateSlug(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// List all tags by category
router.get('/', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;

    let results;
    if (category) {
      results = await db.select()
        .from(tags)
        .where(eq(tags.category, category))
        .orderBy(desc(tags.usageCount), tags.name);
    } else {
      results = await db.select()
        .from(tags)
        .orderBy(desc(tags.usageCount), tags.name);
    }

    // Group by category
    const groupedTags = results.reduce((acc, tag) => {
      if (!acc[tag.category]) {
        acc[tag.category] = [];
      }
      acc[tag.category].push(tag);
      return acc;
    }, {} as Record<string, typeof tags.$inferSelect[]>);

    res.json(groupedTags);
  } catch (error) {
    logger.error('Failed to list tags', error);
    res.status(500).json({ error: 'Failed to list tags' });
  }
});

// Search tags
router.get('/search', async (req: Request, res: Response) => {
  try {
    const params = searchTagsSchema.parse(req.query);

    const whereConditions = [
      ilike(tags.name, `%${params.q}%`)
    ];

    if (params.category) {
      whereConditions.push(eq(tags.category, params.category));
    }

    const results = await db.select()
      .from(tags)
      .where(and(...whereConditions))
      .orderBy(desc(tags.usageCount))
      .limit(params.limit);

    res.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    logger.error('Failed to search tags', error);
    res.status(500).json({ error: 'Failed to search tags' });
  }
});

// Get tag suggestions based on text
router.post('/suggestions', async (req: Request, res: Response) => {
  try {
    const { title, body } = suggestTagsSchema.parse(req.body);
    const combinedText = `${title} ${body}`.toLowerCase();

    // Keywords to tag mapping
    const keywordMappings: Record<string, { category: string; tags: string[] }> = {
      // Grade levels
      kindergarten: { category: 'grade', tags: ['K'] },
      first: { category: 'grade', tags: ['1st'] },
      second: { category: 'grade', tags: ['2nd'] },
      third: { category: 'grade', tags: ['3rd'] },
      fourth: { category: 'grade', tags: ['4th'] },
      fifth: { category: 'grade', tags: ['5th'] },
      sixth: { category: 'grade', tags: ['6th'] },
      seventh: { category: 'grade', tags: ['7th'] },
      eighth: { category: 'grade', tags: ['8th'] },
      
      // Animal types
      otter: { category: 'animal_mix', tags: ['Otter', 'Mostly Otters'] },
      panda: { category: 'animal_mix', tags: ['Panda', 'Mostly Pandas'] },
      beaver: { category: 'animal_mix', tags: ['Beaver', 'Mostly Beavers'] },
      owl: { category: 'animal_mix', tags: ['Owl', 'Mostly Owls'] },
      elephant: { category: 'animal_mix', tags: ['Elephant', 'Mostly Elephants'] },
      parrot: { category: 'animal_mix', tags: ['Parrot', 'Mostly Parrots'] },
      'border collie': { category: 'animal_mix', tags: ['Border Collie', 'Mostly Border Collies'] },
      meerkat: { category: 'animal_mix', tags: ['Meerkat', 'Mostly Meerkats'] },
      mixed: { category: 'animal_mix', tags: ['Mixed Animals'] },
      
      // Challenge types
      attention: { category: 'challenge_type', tags: ['Attention Issues', 'Focus Problems'] },
      energy: { category: 'challenge_type', tags: ['Energy Management', 'High Energy', 'Low Energy'] },
      conflict: { category: 'challenge_type', tags: ['Conflict Resolution', 'Peer Conflicts'] },
      motivation: { category: 'challenge_type', tags: ['Motivation', 'Engagement'] },
      group: { category: 'challenge_type', tags: ['Group Work', 'Collaboration'] },
      time: { category: 'challenge_type', tags: ['Time Management', 'Transitions'] },
      behavior: { category: 'challenge_type', tags: ['Behavior Management', 'Disruptions'] },
      
      // Time of year
      'beginning': { category: 'time_of_year', tags: ['Beginning of Year', 'First Week'] },
      fall: { category: 'time_of_year', tags: ['Fall', 'Autumn'] },
      winter: { category: 'time_of_year', tags: ['Winter', 'Holiday Season'] },
      spring: { category: 'time_of_year', tags: ['Spring', 'Testing Season'] },
      'end': { category: 'time_of_year', tags: ['End of Year', 'Last Week'] },
    };

    const suggestedTagNames = new Set<string>();

    // Find matching keywords
    for (const [keyword, mapping] of Object.entries(keywordMappings)) {
      if (combinedText.includes(keyword)) {
        mapping.tags.forEach(tag => suggestedTagNames.add(tag));
      }
    }

    // Get existing tags that match suggestions
    if (suggestedTagNames.size === 0) {
      return res.json([]);
    }

    const existingTags = await db.select()
      .from(tags)
      .where(inArray(tags.name, Array.from(suggestedTagNames)))
      .orderBy(desc(tags.usageCount));

    res.json(existingTags);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    logger.error('Failed to suggest tags', error);
    res.status(500).json({ error: 'Failed to suggest tags' });
  }
});

export default router;