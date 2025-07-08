/**
 * Monitoring Routes
 * 
 * Provides endpoints for monitoring application health, metrics, and errors
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncWrapper } from '../utils/async-wrapper';
import { metricsService } from '../monitoring/metrics-service';
import { errorTracker } from '../monitoring/error-tracker';
import { ErrorCode } from '../utils/errors';
import { getHttpMetrics } from '../middleware/observability';

const router = Router();

// Removed - functionality moved to /api/admin/metrics/http

/**
 * GET /api/admin/errors/summary
 * Get error tracking summary
 * Requires authentication
 */
router.get('/summary', requireAuth, asyncWrapper(async (req, res, next) => {
  const summary = errorTracker.getErrorSummary();
  
  res.json({
    timestamp: new Date().toISOString(),
    summary: {
      total: summary.totalErrors,
      today: summary.errorsToday,
      rate: summary.errorRate
    },
    breakdown: {
      byCode: summary.errorsByCode,
      byEndpoint: summary.errorsByEndpoint
    },
    topErrors: summary.topErrors,
    recentErrors: summary.recentErrors.map(err => ({
      timestamp: err.timestamp,
      code: err.code,
      message: err.message,
      endpoint: err.endpoint,
      statusCode: err.statusCode
    }))
  });
}));

/**
 * GET /api/admin/errors/:code
 * Get detailed information about a specific error code
 * Requires authentication
 */
router.get('/:code', requireAuth, asyncWrapper(async (req, res, next) => {
  const errorCode = req.params.code as ErrorCode;
  const details = errorTracker.getErrorDetails(errorCode);
  
  if (!details.stats) {
    res.json({
      code: errorCode,
      message: 'No errors found for this code'
    });
    return;
  }
  
  res.json({
    code: errorCode,
    stats: {
      count: details.stats.count,
      firstSeen: details.stats.firstSeen,
      lastSeen: details.stats.lastSeen,
      endpoints: Array.from(details.stats.endpoints)
    },
    recentOccurrences: details.recentOccurrences.map(err => ({
      timestamp: err.timestamp,
      message: err.message,
      endpoint: err.endpoint,
      userId: err.userId,
      requestId: err.requestId
    })),
    samples: details.stats.samples.slice(0, 5)
  });
}));

// Removed - functionality moved to enhanced /api/admin/quick-stats

export default router;