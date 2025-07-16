// Performance Monitoring Service

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

interface UserJourneyMetrics {
  // Quiz/Lesson creation by teachers
  quizCreationAttempts: number;
  quizCreationSuccess: number;
  quizCreationFailures: number;
  averageQuizCreationTime: number;
  
  // Student join flow
  studentJoinAttempts: number;
  studentJoinSuccess: number;
  studentJoinFailures: number;
  averageTimeToJoin: number;
  
  // Game start metrics
  gameStartAttempts: number;
  gameStartSuccess: number;
  gameStartFailures: number;
  
  // Real-time tracking
  recentEvents: Array<{
    type: 'quiz_create' | 'student_join' | 'game_start';
    status: 'attempt' | 'success' | 'failure';
    timestamp: Date;
    metadata?: any;
  }>;
}

export interface PerformanceMetrics {
  timestamp: Date;
  database: DatabaseMetrics;
  system: SystemMetrics;
  userJourney: UserJourneyMetrics;
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
      },
      userJourney: {
        quizCreationAttempts: 0,
        quizCreationSuccess: 0,
        quizCreationFailures: 0,
        averageQuizCreationTime: 0,
        studentJoinAttempts: 0,
        studentJoinSuccess: 0,
        studentJoinFailures: 0,
        averageTimeToJoin: 0,
        gameStartAttempts: 0,
        gameStartSuccess: 0,
        gameStartFailures: 0,
        recentEvents: []
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
    
    // Clean up user journey events older than 1 hour
    this.metrics.userJourney.recentEvents = this.metrics.userJourney.recentEvents.filter(
      e => e.timestamp.getTime() > oneHourAgo
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

  // User Journey Tracking Methods
  trackQuizCreation(status: 'attempt' | 'success' | 'failure', metadata?: any): void {
    if (status === 'attempt') {
      this.metrics.userJourney.quizCreationAttempts++;
    } else if (status === 'success') {
      this.metrics.userJourney.quizCreationSuccess++;
    } else if (status === 'failure') {
      this.metrics.userJourney.quizCreationFailures++;
    }
    
    this.addRecentEvent('quiz_create', status, metadata);
  }
  
  trackStudentJoin(status: 'attempt' | 'success' | 'failure', metadata?: any): void {
    if (status === 'attempt') {
      this.metrics.userJourney.studentJoinAttempts++;
    } else if (status === 'success') {
      this.metrics.userJourney.studentJoinSuccess++;
    } else if (status === 'failure') {
      this.metrics.userJourney.studentJoinFailures++;
    }
    
    this.addRecentEvent('student_join', status, metadata);
  }
  
  trackGameStart(status: 'attempt' | 'success' | 'failure', metadata?: any): void {
    if (status === 'attempt') {
      this.metrics.userJourney.gameStartAttempts++;
    } else if (status === 'success') {
      this.metrics.userJourney.gameStartSuccess++;
    } else if (status === 'failure') {
      this.metrics.userJourney.gameStartFailures++;
    }
    
    this.addRecentEvent('game_start', status, metadata);
  }
  
  private addRecentEvent(type: 'quiz_create' | 'student_join' | 'game_start', status: 'attempt' | 'success' | 'failure', metadata?: any): void {
    this.metrics.userJourney.recentEvents.push({
      type,
      status,
      timestamp: new Date(),
      metadata
    });
    
    // Keep only last 100 events
    if (this.metrics.userJourney.recentEvents.length > 100) {
      this.metrics.userJourney.recentEvents = this.metrics.userJourney.recentEvents.slice(-100);
    }
  }
  
  getUserJourneyMetrics() {
    const journey = this.metrics.userJourney;
    return {
      quizCreation: {
        attempts: journey.quizCreationAttempts,
        success: journey.quizCreationSuccess,
        failures: journey.quizCreationFailures,
        successRate: journey.quizCreationAttempts > 0 ? 
          (journey.quizCreationSuccess / journey.quizCreationAttempts * 100).toFixed(1) + '%' : '0%'
      },
      studentJoin: {
        attempts: journey.studentJoinAttempts,
        success: journey.studentJoinSuccess,
        failures: journey.studentJoinFailures,
        successRate: journey.studentJoinAttempts > 0 ? 
          (journey.studentJoinSuccess / journey.studentJoinAttempts * 100).toFixed(1) + '%' : '0%'
      },
      gameStart: {
        attempts: journey.gameStartAttempts,
        success: journey.gameStartSuccess,
        failures: journey.gameStartFailures,
        successRate: journey.gameStartAttempts > 0 ? 
          (journey.gameStartSuccess / journey.gameStartAttempts * 100).toFixed(1) + '%' : '0%'
      },
      recentEvents: journey.recentEvents.slice(-20) // Last 20 events for dashboard
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