/**
 * HTTP Metrics Routes
 * 
 * Provides HTTP request performance metrics
 */

import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { getHttpMetrics } from '../../middleware/observability';
import { asyncWrapper } from '../../utils/async-wrapper';

const router = Router();

/**
 * GET /api/admin/metrics/http
 * Get HTTP request metrics
 * Admin only
 */
router.get('/http', requireAuth, requireAdmin, asyncWrapper(async (req, res, next) => {
  const httpMetrics = getHttpMetrics();
  
  res.json({
    timestamp: new Date().toISOString(),
    ...httpMetrics
  });
}));

export default router;