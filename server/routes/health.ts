/**
 * Health Check Routes
 * 
 * Provides health status endpoints for monitoring and load balancers
 */

import { Router } from 'express';
import { db, pool, POOL_MAX } from '../db';
import { sql } from 'drizzle-orm';
import { asyncWrapper } from '../utils/async-wrapper';
import { jsonLogger } from '../lib/json-logger';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: CheckResult;
    memory: CheckResult;
    diskSpace?: CheckResult;
  };
  version?: string;
}

interface CheckResult {
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  responseTime?: number;
}

/**
 * GET /health
 * Basic health check - returns 200 if service is up
 */
router.get('/', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /health/live
 * Liveness probe - checks if service is alive
 */
router.get('/live', (req, res) => {
  res.json({ 
    status: 'alive',
    pid: process.pid,
    uptime: process.uptime()
  });
});

/**
 * GET /health/ready
 * Readiness probe - checks if service is ready to accept traffic
 */
router.get('/ready', asyncWrapper(async (req, res, next) => {
  const checks: HealthStatus['checks'] = {
    database: await checkDatabase(),
    memory: checkMemory()
  };
  
  // Determine overall status
  const hasFailure = Object.values(checks).some(check => check.status === 'fail');
  const hasWarning = Object.values(checks).some(check => check.status === 'warn');
  
  const status: HealthStatus['status'] = hasFailure ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy';
  const httpStatus = hasFailure ? 503 : 200;
  
  const response: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
    version: process.env.APP_VERSION || 'unknown'
  };
  
  res.status(httpStatus).json(response);
}));

/**
 * GET /health/detailed
 * Detailed health check with all subsystem checks
 */
router.get('/detailed', asyncWrapper(async (req, res, next) => {
  // Only allow detailed checks from admin or internal IPs
  const isInternal = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip?.includes('10.');
  const isAdmin = req.user?.isAdmin;
  
  if (!isInternal && !isAdmin) {
    res.status(404).json({ message: 'Not found' });
    return;
  }
  
  const checks: HealthStatus['checks'] = {
    database: await checkDatabase(),
    memory: checkMemory(),
    diskSpace: await checkDiskSpace()
  };
  
  // Add additional details
  const detailedResponse = {
    ...getHealthStatus(checks),
    details: {
      node: {
        version: process.version,
        env: process.env.NODE_ENV,
        pid: process.pid
      },
      database: {
        poolSize: POOL_MAX || 0,
        host: process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : 'unknown'
      },
      memory: {
        rss: process.memoryUsage().rss / 1024 / 1024,
        heapTotal: process.memoryUsage().heapTotal / 1024 / 1024,
        heapUsed: process.memoryUsage().heapUsed / 1024 / 1024,
        external: process.memoryUsage().external / 1024 / 1024
      }
    }
  };
  
  const hasFailure = Object.values(checks).some(check => check.status === 'fail');
  const httpStatus = hasFailure ? 503 : 200;
  
  res.status(httpStatus).json(detailedResponse);
}));

/**
 * Check database connectivity and response time
 */
async function checkDatabase(): Promise<CheckResult> {
  const startTime = Date.now();
  
  try {
    await db.execute(sql`SELECT 1`);
    const responseTime = Date.now() - startTime;
    
    if (responseTime > 1000) {
      return {
        status: 'warn',
        message: 'Database response time is high',
        responseTime
      };
    }
    
    return {
      status: 'pass',
      responseTime
    };
  } catch (error) {
    jsonLogger.error('Database health check failed', error, { 
      check: 'database',
      service: 'health'
    });
    
    return {
      status: 'fail',
      message: 'Database connection failed'
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory(): CheckResult {
  const usage = process.memoryUsage();
  const heapUsedMB = usage.heapUsed / 1024 / 1024;
  const heapTotalMB = usage.heapTotal / 1024 / 1024;
  const heapPercentage = (heapUsedMB / heapTotalMB) * 100;
  
  if (heapPercentage > 90) {
    return {
      status: 'fail',
      message: `Memory usage critical: ${heapPercentage.toFixed(1)}%`
    };
  }
  
  if (heapPercentage > 75) {
    return {
      status: 'warn',
      message: `Memory usage high: ${heapPercentage.toFixed(1)}%`
    };
  }
  
  return {
    status: 'pass',
    message: `Memory usage: ${heapPercentage.toFixed(1)}%`
  };
}

/**
 * Check disk space (optional, may not work in all environments)
 */
async function checkDiskSpace(): Promise<CheckResult> {
  // This is a placeholder - actual implementation would depend on the OS
  // and available system tools
  return {
    status: 'pass',
    message: 'Disk space check not implemented'
  };
}

/**
 * Get overall health status from checks
 */
function getHealthStatus(checks: HealthStatus['checks']): HealthStatus {
  const hasFailure = Object.values(checks).some(check => check.status === 'fail');
  const hasWarning = Object.values(checks).some(check => check.status === 'warn');
  
  const status: HealthStatus['status'] = hasFailure ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy';
  
  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
    version: process.env.APP_VERSION || 'unknown'
  };
}

export default router;