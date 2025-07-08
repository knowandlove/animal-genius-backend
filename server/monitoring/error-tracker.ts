/**
 * Error Tracking Service
 * 
 * Collects and aggregates application errors for monitoring and debugging
 */

import { ErrorCode } from '../utils/errors';
import { createSecureLogger } from '../utils/secure-logger';

const logger = createSecureLogger('ErrorTracker');

interface TrackedError {
  timestamp: Date;
  code: ErrorCode;
  message: string;
  statusCode: number;
  endpoint?: string;
  userId?: string;
  requestId?: string;
  stack?: string;
}

interface ErrorStats {
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  endpoints: Set<string>;
  samples: TrackedError[];
}

interface ErrorSummary {
  totalErrors: number;
  errorsToday: number;
  errorsByCode: Record<ErrorCode, number>;
  errorsByEndpoint: Record<string, number>;
  errorRate: number;
  recentErrors: TrackedError[];
  topErrors: Array<{
    code: ErrorCode;
    message: string;
    count: number;
    lastSeen: Date;
  }>;
}

class ErrorTracker {
  private errors: TrackedError[] = [];
  private errorStats: Map<string, ErrorStats> = new Map();
  private readonly maxErrors = 1000; // Keep last 1000 errors
  private readonly maxSamplesPerError = 5;
  
  /**
   * Track an error occurrence
   */
  trackError(error: {
    code: ErrorCode;
    message: string;
    statusCode: number;
    endpoint?: string;
    userId?: string;
    requestId?: string;
    stack?: string;
  }) {
    const trackedError: TrackedError = {
      ...error,
      timestamp: new Date()
    };
    
    // Add to recent errors
    this.errors.push(trackedError);
    
    // Maintain max size
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }
    
    // Update stats
    this.updateErrorStats(trackedError);
    
    // Log critical errors
    if (error.statusCode >= 500) {
      logger.error('Critical error tracked', {
        code: error.code,
        message: error.message,
        endpoint: error.endpoint,
        requestId: error.requestId
      });
    }
  }
  
  /**
   * Update error statistics
   */
  private updateErrorStats(error: TrackedError) {
    const key = `${error.code}:${error.message}`;
    const stats = this.errorStats.get(key);
    
    if (stats) {
      stats.count++;
      stats.lastSeen = error.timestamp;
      if (error.endpoint) {
        stats.endpoints.add(error.endpoint);
      }
      
      // Keep sample errors
      if (stats.samples.length < this.maxSamplesPerError) {
        stats.samples.push(error);
      }
    } else {
      this.errorStats.set(key, {
        count: 1,
        firstSeen: error.timestamp,
        lastSeen: error.timestamp,
        endpoints: error.endpoint ? new Set([error.endpoint]) : new Set(),
        samples: [error]
      });
    }
  }
  
  /**
   * Get error summary for monitoring
   */
  getErrorSummary(): ErrorSummary {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    // Count errors today
    const errorsToday = this.errors.filter(e => e.timestamp >= todayStart).length;
    
    // Count by error code
    const errorsByCode: Record<ErrorCode, number> = {} as any;
    const errorsByEndpoint: Record<string, number> = {};
    
    this.errors.forEach(error => {
      // By code
      errorsByCode[error.code] = (errorsByCode[error.code] || 0) + 1;
      
      // By endpoint
      if (error.endpoint) {
        errorsByEndpoint[error.endpoint] = (errorsByEndpoint[error.endpoint] || 0) + 1;
      }
    });
    
    // Calculate error rate (errors per minute for last hour)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentErrors = this.errors.filter(e => e.timestamp >= oneHourAgo);
    const errorRate = recentErrors.length / 60;
    
    // Get top errors
    const topErrors = Array.from(this.errorStats.entries())
      .map(([key, stats]) => {
        const [code, ...messageParts] = key.split(':');
        return {
          code: code as ErrorCode,
          message: messageParts.join(':'),
          count: stats.count,
          lastSeen: stats.lastSeen
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return {
      totalErrors: this.errors.length,
      errorsToday,
      errorsByCode,
      errorsByEndpoint,
      errorRate,
      recentErrors: this.errors.slice(-20).reverse(), // Last 20 errors
      topErrors
    };
  }
  
  /**
   * Get detailed error information
   */
  getErrorDetails(errorCode: ErrorCode): {
    stats: ErrorStats | null;
    recentOccurrences: TrackedError[];
  } {
    // Find all stats entries for this error code
    const relevantStats: ErrorStats[] = [];
    const recentOccurrences: TrackedError[] = [];
    
    this.errorStats.forEach((stats, key) => {
      if (key.startsWith(`${errorCode}:`)) {
        relevantStats.push(stats);
      }
    });
    
    // Aggregate stats
    if (relevantStats.length === 0) {
      return { stats: null, recentOccurrences: [] };
    }
    
    const aggregatedStats: ErrorStats = {
      count: relevantStats.reduce((sum, s) => sum + s.count, 0),
      firstSeen: new Date(Math.min(...relevantStats.map(s => s.firstSeen.getTime()))),
      lastSeen: new Date(Math.max(...relevantStats.map(s => s.lastSeen.getTime()))),
      endpoints: new Set(),
      samples: []
    };
    
    relevantStats.forEach(stats => {
      stats.endpoints.forEach(ep => aggregatedStats.endpoints.add(ep));
      aggregatedStats.samples.push(...stats.samples);
    });
    
    // Get recent occurrences
    const recent = this.errors
      .filter(e => e.code === errorCode)
      .slice(-10)
      .reverse();
    
    return {
      stats: aggregatedStats,
      recentOccurrences: recent
    };
  }
  
  /**
   * Clear old errors (call periodically)
   */
  clearOldErrors(daysToKeep: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    // Clear old errors from array
    this.errors = this.errors.filter(e => e.timestamp > cutoffDate);
    
    // Clear old stats
    this.errorStats.forEach((stats, key) => {
      if (stats.lastSeen < cutoffDate) {
        this.errorStats.delete(key);
      }
    });
    
    logger.info('Cleared old errors', {
      remaining: this.errors.length,
      statsRemaining: this.errorStats.size
    });
  }
}

// Export singleton instance
export const errorTracker = new ErrorTracker();

// Clear old errors daily
setInterval(() => {
  errorTracker.clearOldErrors();
}, 24 * 60 * 60 * 1000);