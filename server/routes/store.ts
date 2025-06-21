import { Router } from 'express';
import { db } from '../db';
import { storeItems } from '@shared/schema';
import { eq, asc, inArray } from 'drizzle-orm';
import StorageRouter from '../services/storage-router';

const router = Router();

/**
 * GET /api/store/catalog
 * Get all active store items for students
 */
router.get('/catalog', async (req, res) => {
  try {
    console.log('=== STORE CATALOG ENDPOINT HIT ===');
    console.log('Cloud storage enabled?', StorageRouter.isCloudStorageEnabled());
    
    const items = await db
      .select()
      .from(storeItems)
      .where(eq(storeItems.isActive, true))
      .orderBy(asc(storeItems.sortOrder), asc(storeItems.name));
    
    console.log(`Found ${items.length} items`);
    console.log('Raw first item:', JSON.stringify(items[0], null, 2));
    
    // Prepare items with proper image URLs using StorageRouter
    const preparedItems = await StorageRouter.prepareStoreItemsResponse(items);
    
    console.log('Prepared first item:', JSON.stringify(preparedItems[0], null, 2));
    
    res.json(preparedItems);
  } catch (error) {
    console.error('Error fetching store catalog:', error);
    res.status(500).json({ error: 'Failed to fetch store catalog' });
  }
});

/**
 * POST /api/store/items/batch
 * Get multiple items by IDs (for loading owned items)
 */
router.post('/items/batch', async (req, res) => {
  try {
    const { itemIds } = req.body;
    
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.json([]);
    }
    
    // Limit to prevent abuse
    const limitedIds = itemIds.slice(0, 100);
    
    const items = await db
      .select()
      .from(storeItems)
      .where(inArray(storeItems.id, limitedIds));
    
    // Prepare items with proper image URLs
    const preparedItems = await StorageRouter.prepareStoreItemsResponse(items);
    
    res.json(preparedItems);
  } catch (error) {
    console.error('Error fetching items by IDs:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

export default router;
