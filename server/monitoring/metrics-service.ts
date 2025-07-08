// Performance Monitoring Service
// Game and WebSocket metrics have been removed - will be re-implemented on a different server

interface DatabaseMetrics {
  queryCount: number;
  averageQueryTime: number;
  slowQueries: Array<{ query: string; duration: number; timestamp: Date }>;
  connectionPoolSize: number;
  failedQueries: number;
}

interface SystemMetrics {
  memoryUsage: number;
  cpuUsage: number;
  uptime: number;
  lastRestart: Date;
}

export interface PerformanceMetrics {
  timestamp: Date;
  database: DatabaseMetrics;
  system: SystemMetrics;
}

class MetricsService {
  private metrics: PerformanceMetrics;
  private startTime: Date;
  private queryBuffer: Array<{ query: string; duration: number; timestamp: Date }> = [];
  
  // Cleanup intervals
  private metricsCleanupInterval?: NodeJS.Timeout;
  private bufferCleanupInterval?: NodeJS.Timeout;

  constructor() {
    this.startTime = new Date();
    this.metrics = this.initializeMetrics();
    this.startCleanupIntervals();
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      timestamp: new Date(),
      database: {
        queryCount: 0,
        averageQueryTime: 0,
        slowQueries: [],
        connectionPoolSize: 0,
        failedQueries: 0
      },
      system: {
        memoryUsage: 0,
        cpuUsage: 0,
        uptime: 0,
        lastRestart: this.startTime
      }
    };
  }

  private startCleanupIntervals() {
    // Clean up old metrics every 5 minutes
    this.metricsCleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 5 * 60 * 1000);

    // Clean up buffers every minute
    this.bufferCleanupInterval = setInterval(() => {
      this.cleanupBuffers();
    }, 60 * 1000);
  }

  private cleanupOldMetrics() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    // Clean up slow queries older than 1 hour
    this.metrics.database.slowQueries = this.metrics.database.slowQueries.filter(
      q => q.timestamp.getTime() > oneHourAgo
    );
  }

  private cleanupBuffers() {
    const oneMinuteAgo = Date.now() - 60 * 1000;
    
    // Clean up query buffer
    this.queryBuffer = this.queryBuffer.filter(
      q => q.timestamp.getTime() > oneMinuteAgo
    );
  }

  // Database metrics
  recordQuery(query: string, duration: number): void {
    this.metrics.database.queryCount++;
    
    this.queryBuffer.push({
      query,
      duration,
      timestamp: new Date()
    });

    // Update average query time
    const recentQueries = this.queryBuffer.filter(
      q => q.timestamp.getTime() > Date.now() - 60 * 1000
    );
    
    if (recentQueries.length > 0) {
      this.metrics.database.averageQueryTime = 
        recentQueries.reduce((sum, q) => sum + q.duration, 0) / recentQueries.length;
    }

    // Track slow queries (over 1 second)
    if (duration > 1000) {
      this.metrics.database.slowQueries.push({
        query,
        duration,
        timestamp: new Date()
      });
      
      // Keep only the latest 100 slow queries
      if (this.metrics.database.slowQueries.length > 100) {
        this.metrics.database.slowQueries = this.metrics.database.slowQueries.slice(-100);
      }
    }
  }

  recordFailedQuery(): void {
    this.metrics.database.failedQueries++;
  }

  updateConnectionPoolSize(size: number): void {
    this.metrics.database.connectionPoolSize = size;
  }

  // System metrics
  updateSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    this.metrics.system.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
    this.metrics.system.uptime = Date.now() - this.startTime.getTime();
    
    // CPU usage would need more complex implementation
    // For now, just updating timestamp
    this.metrics.timestamp = new Date();
  }

  // Get current metrics
  getMetrics(): PerformanceMetrics {
    this.updateSystemMetrics();
    return { ...this.metrics };
  }

  // Get metrics summary for monitoring endpoints
  getMetricsSummary() {
    this.updateSystemMetrics();
    return {
      uptime: Math.floor(this.metrics.system.uptime / 1000), // seconds
      database: {
        totalQueries: this.metrics.database.queryCount,
        averageQueryTime: Math.round(this.metrics.database.averageQueryTime),
        slowQueries: this.metrics.database.slowQueries.length,
        failedQueries: this.metrics.database.failedQueries,
        connectionPoolSize: this.metrics.database.connectionPoolSize
      },
      system: {
        memoryUsageMB: Math.round(this.metrics.system.memoryUsage),
        uptimeHours: Math.round(this.metrics.system.uptime / 1000 / 60 / 60 * 100) / 100
      }
    };
  }

  // Cleanup method
  cleanup(): void {
    if (this.metricsCleanupInterval) {
      clearInterval(this.metricsCleanupInterval);
    }
    if (this.bufferCleanupInterval) {
      clearInterval(this.bufferCleanupInterval);
    }
  }

  // Health check
  isHealthy(): boolean {
    // Consider unhealthy if too many failed queries
    const failureRate = this.metrics.database.failedQueries / Math.max(this.metrics.database.queryCount, 1);
    return failureRate < 0.05; // Less than 5% failure rate
  }
}

// Export singleton instance
export const metricsService = new MetricsService();