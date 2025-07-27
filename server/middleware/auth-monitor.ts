import type { Request, Response, NextFunction } from 'express';
import { CONFIG } from '../config/constants';

interface AuthMetrics {
  totalRequests: number;
  successfulAuth: number;
  failedAuth: number;
  avgResponseTime: number;
  slowRequests: number; // > 1000ms
  recentResponses: number[]; // Rolling window of last 100 response times
}

const authMetrics: AuthMetrics = {
  totalRequests: 0,
  successfulAuth: 0,
  failedAuth: 0,
  avgResponseTime: 0,
  slowRequests: 0,
  recentResponses: []
};

const SLOW_REQUEST_THRESHOLD = CONFIG.TIMEOUTS.SLOW_REQUEST_THRESHOLD;
const ROLLING_WINDOW_SIZE = CONFIG.MONITORING.METRICS_ROLLING_WINDOW;

/**
 * Middleware to monitor authentication performance
 */
export function authPerformanceMonitor(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  // Track the response
  const originalSend = res.send;
  res.send = function(body) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Update metrics
    authMetrics.totalRequests++;
    
    // Track response time
    authMetrics.recentResponses.push(responseTime);
    if (authMetrics.recentResponses.length > ROLLING_WINDOW_SIZE) {
      authMetrics.recentResponses.shift();
    }
    
    // Calculate average
    authMetrics.avgResponseTime = authMetrics.recentResponses.reduce((a, b) => a + b, 0) / authMetrics.recentResponses.length;
    
    // Track slow requests
    if (responseTime > SLOW_REQUEST_THRESHOLD) {
      authMetrics.slowRequests++;
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Slow auth request: ${req.method} ${req.path} took ${responseTime}ms`);
      }
    }
    
    // Track success/failure
    if (res.statusCode >= 200 && res.statusCode < 300) {
      authMetrics.successfulAuth++;
    } else if (res.statusCode >= 400) {
      authMetrics.failedAuth++;
      // Log failed auth attempts in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`Auth failure: ${req.method} ${req.path} - Status: ${res.statusCode}`);
      }
    }
    
    // Add performance headers for development
    if (process.env.NODE_ENV === 'development') {
      res.setHeader('X-Auth-Response-Time', responseTime);
      res.setHeader('X-Auth-Avg-Response-Time', Math.round(authMetrics.avgResponseTime));
    }
    
    return originalSend.call(this, body);
  };
  
  next();
}

/**
 * Get authentication metrics
 */
export function getAuthMetrics() {
  const successRate = authMetrics.totalRequests > 0 
    ? (authMetrics.successfulAuth / authMetrics.totalRequests) * 100 
    : 0;
    
  const slowRequestRate = authMetrics.totalRequests > 0
    ? (authMetrics.slowRequests / authMetrics.totalRequests) * 100
    : 0;

  return {
    ...authMetrics,
    successRate: Math.round(successRate * 100) / 100,
    slowRequestRate: Math.round(slowRequestRate * 100) / 100,
    p95ResponseTime: calculatePercentile(authMetrics.recentResponses, 0.95),
    p99ResponseTime: calculatePercentile(authMetrics.recentResponses, 0.99)
  };
}

/**
 * Calculate percentile from array of numbers
 */
function calculatePercentile(arr: number[], percentile: number): number {
  if (arr.length === 0) return 0;
  
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * percentile) - 1;
  return sorted[index] || 0;
}

/**
 * Reset metrics (for testing/debugging)
 */
export function resetAuthMetrics() {
  authMetrics.totalRequests = 0;
  authMetrics.successfulAuth = 0;
  authMetrics.failedAuth = 0;
  authMetrics.avgResponseTime = 0;
  authMetrics.slowRequests = 0;
  authMetrics.recentResponses = [];
}

/**
 * Log periodic performance summary
 */
export function startPerformanceLogging() {
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      const metrics = getAuthMetrics();
      if (metrics.totalRequests > 0) {
        console.log('Auth Performance Summary:', {
          totalRequests: metrics.totalRequests,
          successRate: `${metrics.successRate}%`,
          avgResponseTime: `${Math.round(metrics.avgResponseTime)}ms`,
          slowRequestRate: `${metrics.slowRequestRate}%`,
          p95: `${metrics.p95ResponseTime}ms`,
          p99: `${metrics.p99ResponseTime}ms`
        });
      }
    }, CONFIG.MONITORING.PERFORMANCE_LOG_INTERVAL);
  }
}