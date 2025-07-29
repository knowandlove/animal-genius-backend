import { Router } from 'express';
import { db } from '../db';
import { storeItems } from '@shared/schema';
import { eq, asc, inArray, sql } from 'drizzle-orm';
import StorageRouter from '../services/storage-router';
import { storeBrowsingLimiter } from '../middleware/rateLimiter';
import { getPaginationParams, createPaginatedResponse, setPaginationHeaders } from '../utils/pagination';
import { asyncWrapper } from '../utils/async-wrapper';
import { InternalError, ErrorCode } from '../utils/errors';
import { createSecureLogger } from '../utils/secure-logger';
import { getCache } from '../lib/cache-factory';

const _logger = createSecureLogger('StoreRoutes');

const router = Router();

// Cache configuration
const CATALOG_CACHE_KEY = 'store:catalog:active';
const CATALOG_CACHE_TTL = 300; // 5 minutes in seconds

/**
 * GET /api/store/catalog
 * Get active store items with pagination
 * Query params: ?page=1&limit=20
 */
router.get('/catalog', storeBrowsingLimiter, asyncWrapper(async (req, res, _next) => {
  const { page, limit, offset } = getPaginationParams(req);
  
  // Get cache instance
  const cache = getCache();
  
  // For backward compatibility, if no pagination params provided, return all items from cache
  if (!req.query.page && !req.query.limit) {
    // Check cache first
    const cachedData = await cache.get<any[]>(CATALOG_CACHE_KEY);
    if (cachedData) {
      res.json(cachedData);
      return;
    }
    
    const items = await db
      .select()
      .from(storeItems)
      .where(eq(storeItems.isActive, true))
      .orderBy(asc(storeItems.sortOrder), asc(storeItems.name));
    
    // Prepare items with proper image URLs using StorageRouter
    const preparedItems = await StorageRouter.prepareStoreItemsResponse(items);
    
    // Cache the result in centralized cache
    await cache.set(CATALOG_CACHE_KEY, preparedItems, CATALOG_CACHE_TTL);
    
    res.json(preparedItems);
    return;
  }
  
  // Paginated response
  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(storeItems)
    .where(eq(storeItems.isActive, true));
  
  // Get paginated items
  const items = await db
    .select()
    .from(storeItems)
    .where(eq(storeItems.isActive, true))
    .orderBy(asc(storeItems.sortOrder), asc(storeItems.name))
    .limit(limit)
    .offset(offset);
  
  // Prepare items with proper image URLs
  const preparedItems = await StorageRouter.prepareStoreItemsResponse(items);
  
  // Create paginated response
  const response = createPaginatedResponse(preparedItems, page, limit, Number(count));
  
  // Set pagination headers
  setPaginationHeaders(res, page, limit, Number(count));
  
  res.json(response);
}));

/**
 * POST /api/store/items/batch
 * Get multiple items by IDs (for loading owned items)
 */
router.post('/items/batch', storeBrowsingLimiter, asyncWrapper(async (req, res, _next) => {
  const { itemIds } = req.body;
  
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    res.json([]);
    return;
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
}));

export default router;
