/**
 * Observability Middleware
 * 
 * Provides structured logging and metrics collection for all HTTP requests
 */

import { Request, Response, NextFunction } from 'express';
import { jsonLogger } from '../lib/json-logger';
import { metricsService } from '../monitoring/metrics-service';

interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  contentLength?: number;
  userAgent?: string;
  requestId?: string;
  userId?: string;
  error?: boolean;
}

/**
 * HTTP request metrics middleware
 * Tracks request duration, status codes, and error rates
 */
export function httpMetricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const method = req.method;
  const path = req.path;
  
  // Capture original end function
  const originalEnd = res.end;
  
  // Override end function to capture metrics
  res.end = function(...args: any[]): any {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // Collect metrics
    const metrics: RequestMetrics = {
      method,
      path: sanitizePath(path),
      statusCode,
      duration,
      contentLength: res.get('content-length') ? parseInt(res.get('content-length')!) : undefined,
      userAgent: req.get('user-agent'),
      requestId: req.id,
      userId: req.user?.userId,
      error: statusCode >= 400
    };
    
    // Track in metrics service
    trackHttpMetrics(metrics);
    
    // Update HTTP metrics store
    updateHttpMetrics(metrics);
    
    // Log structured data
    logHttpRequest(metrics);
    
    // Call original end with the same arguments
    return originalEnd.apply(res, args);
  };
  
  next();
}

/**
 * Sanitize path to remove sensitive parameters
 * e.g., /api/students/123 -> /api/students/:id
 */
function sanitizePath(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id') // UUIDs
    .replace(/\/\d+/g, '/:id') // Numeric IDs
    .replace(/\?.*$/, ''); // Remove query params
}

/**
 * Track HTTP metrics in metrics service
 */
function trackHttpMetrics(metrics: RequestMetrics) {
  // Track database metrics if this was a DB-heavy endpoint
  if (isDataEndpoint(metrics.path)) {
    metricsService.recordQuery(`HTTP_${metrics.method}_${metrics.path}`, metrics.duration);
    
    // Record failed queries
    if (metrics.error) {
      metricsService.recordFailedQuery();
    }
  }
}

/**
 * Check if endpoint is data-heavy (involves database operations)
 */
function isDataEndpoint(path: string): boolean {
  const dataPatterns = [
    /^\/api\/classes/,
    /^\/api\/students/,
    /^\/api\/submissions/,
    /^\/api\/store/,
    /^\/api\/analytics/,
    /^\/api\/currency/
  ];
  
  return dataPatterns.some(pattern => pattern.test(path));
}

/**
 * Log HTTP request with appropriate level
 */
function logHttpRequest(metrics: RequestMetrics) {
  const logData = {
    method: metrics.method,
    path: metrics.path,
    statusCode: metrics.statusCode,
    duration: metrics.duration,
    requestId: metrics.requestId,
    userId: metrics.userId
  };
  
  // Determine log level based on status code and duration
  if (metrics.statusCode >= 500) {
    jsonLogger.error('HTTP request server error', undefined, logData);
  } else if (metrics.statusCode >= 400) {
    jsonLogger.warn('HTTP request client error', logData);
  } else if (metrics.duration > 1000) {
    jsonLogger.warn('Slow HTTP request', logData);
  } else if (process.env.NODE_ENV === 'development') {
    jsonLogger.debug('HTTP request', logData);
  }
}

/**
 * Performance monitoring endpoint middleware
 * Provides detailed metrics at /api/metrics (admin only)
 */
export function metricsEndpoint(req: Request, res: Response) {
  // Check if user is admin
  if (!req.user?.isAdmin) {
    return res.status(404).json({ message: 'Not found' });
  }
  
  const metrics = metricsService.getMetrics();
  const httpMetrics = getHttpMetrics();
  
  res.json({
    ...metrics,
    http: httpMetrics,
    environment: {
      nodeVersion: process.version,
      env: process.env.NODE_ENV,
      pid: process.pid
    }
  });
}

// Simple in-memory HTTP metrics storage
export const httpMetricsStore = {
  totalRequests: 0,
  requestsByMethod: new Map<string, number>(),
  requestsByStatus: new Map<number, number>(),
  errorRate: 0,
  averageResponseTime: 0,
  slowestEndpoints: [] as Array<{ path: string; duration: number }>
};

export function getHttpMetrics() {
  return {
    totalRequests: httpMetricsStore.totalRequests,
    requestsByMethod: Object.fromEntries(httpMetricsStore.requestsByMethod),
    requestsByStatus: Object.fromEntries(httpMetricsStore.requestsByStatus),
    errorRate: httpMetricsStore.errorRate,
    averageResponseTime: httpMetricsStore.averageResponseTime,
    slowestEndpoints: httpMetricsStore.slowestEndpoints
  };
}

// Update HTTP metrics store
export function updateHttpMetrics(metrics: RequestMetrics) {
  httpMetricsStore.totalRequests++;
  
  // Update method counts
  const methodCount = httpMetricsStore.requestsByMethod.get(metrics.method) || 0;
  httpMetricsStore.requestsByMethod.set(metrics.method, methodCount + 1);
  
  // Update status counts
  const statusCount = httpMetricsStore.requestsByStatus.get(metrics.statusCode) || 0;
  httpMetricsStore.requestsByStatus.set(metrics.statusCode, statusCount + 1);
  
  // Update average response time
  httpMetricsStore.averageResponseTime = 
    (httpMetricsStore.averageResponseTime * (httpMetricsStore.totalRequests - 1) + metrics.duration) / 
    httpMetricsStore.totalRequests;
  
  // Track slow endpoints
  if (metrics.duration > 1000) {
    httpMetricsStore.slowestEndpoints.push({
      path: metrics.path,
      duration: metrics.duration
    });
    
    // Keep only top 10 slowest
    httpMetricsStore.slowestEndpoints.sort((a, b) => b.duration - a.duration);
    httpMetricsStore.slowestEndpoints = httpMetricsStore.slowestEndpoints.slice(0, 10);
  }
  
  // Calculate error rate
  let errorCount = 0;
  httpMetricsStore.requestsByStatus.forEach((count, status) => {
    if (status >= 400) errorCount += count;
  });
  httpMetricsStore.errorRate = (errorCount / httpMetricsStore.totalRequests) * 100;
}