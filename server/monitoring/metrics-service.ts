// Performance Monitoring Service for WebSocket System
// Tracks connections, throughput, database performance, and game metrics

interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  teacherConnections: number;
  playerConnections: number;
  connectionsPeakToday: number;
  connectionsPerMinute: number[];
  disconnectionsPerMinute: number[];
}

interface MessageMetrics {
  totalMessages: number;
  messagesPerSecond: number;
  messagesPerMinute: number[];
  messageTypeCount: Map<string, number>;
  errorCount: number;
  errorRate: number;
}

interface GameMetrics {
  activeGames: number;
  totalGamesCreated: number;
  totalPlayersJoined: number;
  averagePlayersPerGame: number;
  averageGameDuration: number;
  gamesCompletedToday: number;
  peakActiveGames: number;
}

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
  connections: ConnectionMetrics;
  messages: MessageMetrics;
  games: GameMetrics;
  database: DatabaseMetrics;
  system: SystemMetrics;
}

class MetricsService {
  private metrics: PerformanceMetrics;
  private startTime: Date;
  private messageBuffer: Array<{ type: string; timestamp: Date }> = [];
  private connectionBuffer: Array<{ action: 'connect' | 'disconnect'; timestamp: Date }> = [];
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
      connections: {
        totalConnections: 0,
        activeConnections: 0,
        teacherConnections: 0,
        playerConnections: 0,
        connectionsPeakToday: 0,
        connectionsPerMinute: new Array(60).fill(0),
        disconnectionsPerMinute: new Array(60).fill(0)
      },
      messages: {
        totalMessages: 0,
        messagesPerSecond: 0,
        messagesPerMinute: new Array(60).fill(0),
        messageTypeCount: new Map(),
        errorCount: 0,
        errorRate: 0
      },
      games: {
        activeGames: 0,
        totalGamesCreated: 0,
        totalPlayersJoined: 0,
        averagePlayersPerGame: 0,
        averageGameDuration: 0,
        gamesCompletedToday: 0,
        peakActiveGames: 0
      },
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

  // Connection tracking
  trackConnection(isTeacher: boolean = false) {
    this.metrics.connections.totalConnections++;
    this.metrics.connections.activeConnections++;
    
    if (isTeacher) {
      this.metrics.connections.teacherConnections++;
    } else {
      this.metrics.connections.playerConnections++;
    }

    // Update peak
    if (this.metrics.connections.activeConnections > this.metrics.connections.connectionsPeakToday) {
      this.metrics.connections.connectionsPeakToday = this.metrics.connections.activeConnections;
    }

    // Add to buffer for rate calculations
    this.connectionBuffer.push({ action: 'connect', timestamp: new Date() });

    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Connection tracked: ${this.metrics.connections.activeConnections} active (${this.metrics.connections.teacherConnections} teachers, ${this.metrics.connections.playerConnections} players)`);
    }
  }

  trackDisconnection(isTeacher: boolean = false) {
    this.metrics.connections.activeConnections = Math.max(0, this.metrics.connections.activeConnections - 1);
    
    if (isTeacher) {
      this.metrics.connections.teacherConnections = Math.max(0, this.metrics.connections.teacherConnections - 1);
    } else {
      this.metrics.connections.playerConnections = Math.max(0, this.metrics.connections.playerConnections - 1);
    }

    // Add to buffer for rate calculations
    this.connectionBuffer.push({ action: 'disconnect', timestamp: new Date() });

    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Disconnection tracked: ${this.metrics.connections.activeConnections} active remaining`);
    }
  }

  // Message tracking
  trackMessage(messageType: string, isError: boolean = false) {
    this.metrics.messages.totalMessages++;
    
    if (isError) {
      this.metrics.messages.errorCount++;
    }

    // Track message types
    const currentCount = this.metrics.messages.messageTypeCount.get(messageType) || 0;
    this.metrics.messages.messageTypeCount.set(messageType, currentCount + 1);

    // Add to buffer for rate calculations
    this.messageBuffer.push({ type: messageType, timestamp: new Date() });

    // Calculate error rate
    this.metrics.messages.errorRate = (this.metrics.messages.errorCount / this.metrics.messages.totalMessages) * 100;
  }

  // Game tracking
  trackGameCreated() {
    this.metrics.games.totalGamesCreated++;
    this.metrics.games.activeGames++;

    // Update peak
    if (this.metrics.games.activeGames > this.metrics.games.peakActiveGames) {
      this.metrics.games.peakActiveGames = this.metrics.games.activeGames;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Game created: ${this.metrics.games.activeGames} active games`);
    }
  }

  trackGameCompleted(duration: number) {
    this.metrics.games.activeGames = Math.max(0, this.metrics.games.activeGames - 1);
    this.metrics.games.gamesCompletedToday++;

    // Update average duration
    this.metrics.games.averageGameDuration = 
      (this.metrics.games.averageGameDuration * (this.metrics.games.gamesCompletedToday - 1) + duration) / 
      this.metrics.games.gamesCompletedToday;

    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Game completed: ${this.metrics.games.activeGames} active games remaining, duration: ${duration}ms`);
    }
  }

  trackPlayerJoined() {
    this.metrics.games.totalPlayersJoined++;

    // Recalculate average players per game
    if (this.metrics.games.totalGamesCreated > 0) {
      this.metrics.games.averagePlayersPerGame = 
        this.metrics.games.totalPlayersJoined / this.metrics.games.totalGamesCreated;
    }
  }

  // Database tracking
  trackDatabaseQuery(queryType: string, duration: number, success: boolean = true) {
    this.metrics.database.queryCount++;

    if (!success) {
      this.metrics.database.failedQueries++;
    }

    // Update average query time
    this.metrics.database.averageQueryTime = 
      (this.metrics.database.averageQueryTime * (this.metrics.database.queryCount - 1) + duration) / 
      this.metrics.database.queryCount;

    // Track slow queries (>1000ms)
    if (duration > 1000) {
      this.metrics.database.slowQueries.push({
        query: queryType,
        duration,
        timestamp: new Date()
      });

      // Keep only last 10 slow queries
      if (this.metrics.database.slowQueries.length > 10) {
        this.metrics.database.slowQueries = this.metrics.database.slowQueries.slice(-10);
      }

      if (process.env.NODE_ENV === 'development') {
        console.warn(`🐌 Slow database query: ${queryType} took ${duration}ms`);
      }
    }

    // Add to buffer for analysis
    this.queryBuffer.push({ query: queryType, duration, timestamp: new Date() });
  }

  // Get current metrics
  getCurrentMetrics(): PerformanceMetrics {
    this.updateCalculatedMetrics();
    return {
      ...this.metrics,
      timestamp: new Date()
    };
  }

  // Get metrics summary for logging
  getMetricsSummary(): string {
    const metrics = this.getCurrentMetrics();
    return `Connections: ${metrics.connections.activeConnections} active (${metrics.connections.teacherConnections}T/${metrics.connections.playerConnections}P) | ` +
           `Games: ${metrics.games.activeGames} active | ` +
           `Messages/sec: ${metrics.messages.messagesPerSecond.toFixed(1)} | ` +
           `DB avg: ${metrics.database.averageQueryTime.toFixed(0)}ms | ` +
           `Memory: ${metrics.system.memoryUsage.toFixed(1)}MB`;
  }

  // Reset daily metrics (call at midnight)
  resetDailyMetrics() {
    this.metrics.connections.connectionsPeakToday = this.metrics.connections.activeConnections;
    this.metrics.games.gamesCompletedToday = 0;
    this.metrics.games.peakActiveGames = this.metrics.games.activeGames;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Daily metrics reset');
    }
  }

  private updateCalculatedMetrics() {
    // Update system metrics
    const memUsage = process.memoryUsage();
    this.metrics.system.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
    this.metrics.system.uptime = (Date.now() - this.startTime.getTime()) / 1000; // seconds

    // Calculate messages per second (last 60 seconds)
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentMessages = this.messageBuffer.filter(m => m.timestamp > oneMinuteAgo);
    this.metrics.messages.messagesPerSecond = recentMessages.length / 60;

    // Calculate connections per minute
    const connectionsLastMinute = this.connectionBuffer.filter(c => 
      c.timestamp > oneMinuteAgo && c.action === 'connect'
    );
    this.metrics.connections.connectionsPerMinute[59] = connectionsLastMinute.length;

    const disconnectionsLastMinute = this.connectionBuffer.filter(c => 
      c.timestamp > oneMinuteAgo && c.action === 'disconnect'
    );
    this.metrics.connections.disconnectionsPerMinute[59] = disconnectionsLastMinute.length;
  }

  private startCleanupIntervals() {
    // Update metrics every 60 seconds instead of 10 seconds
    this.metricsCleanupInterval = setInterval(() => {
      this.updateCalculatedMetrics();
      
      // Log summary every 5 minutes in development only when there's activity
      if (process.env.NODE_ENV === 'development' && this.hasRecentActivity()) {
        console.log(`📊 Metrics Summary: ${this.getMetricsSummary()}`);
      }
    }, 60000);

    // Clean old buffer data every 5 minutes
    this.bufferCleanupInterval = setInterval(() => {
      const fiveMinutesAgo = new Date(Date.now() - 300000);
      
      this.messageBuffer = this.messageBuffer.filter(m => m.timestamp > fiveMinutesAgo);
      this.connectionBuffer = this.connectionBuffer.filter(c => c.timestamp > fiveMinutesAgo);
      this.queryBuffer = this.queryBuffer.filter(q => q.timestamp > fiveMinutesAgo);
      
      // Shift minute arrays
      this.metrics.connections.connectionsPerMinute.shift();
      this.metrics.connections.connectionsPerMinute.push(0);
      this.metrics.connections.disconnectionsPerMinute.shift();
      this.metrics.connections.disconnectionsPerMinute.push(0);
      this.metrics.messages.messagesPerMinute.shift();
      this.metrics.messages.messagesPerMinute.push(0);
    }, 60000); // Every minute
  }

  private hasRecentActivity(): boolean {
    const fiveMinutesAgo = new Date(Date.now() - 300000);
    return this.messageBuffer.some(m => m.timestamp > fiveMinutesAgo) ||
           this.connectionBuffer.some(c => c.timestamp > fiveMinutesAgo) ||
           this.queryBuffer.some(q => q.timestamp > fiveMinutesAgo);
  }

  // Cleanup method
  cleanup() {
    if (this.metricsCleanupInterval) {
      clearInterval(this.metricsCleanupInterval);
      this.metricsCleanupInterval = undefined;
    }
    
    if (this.bufferCleanupInterval) {
      clearInterval(this.bufferCleanupInterval);
      this.bufferCleanupInterval = undefined;
    }
    
    console.log('📊 Metrics service cleaned up');
  }
}

// Export singleton instance
export const metricsService = new MetricsService();

// Helper function to create database query wrapper
export function withDatabaseMetrics<T>(
  queryName: string, 
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  return queryFn()
    .then(result => {
      const duration = Date.now() - startTime;
      metricsService.trackDatabaseQuery(queryName, duration, true);
      return result;
    })
    .catch(error => {
      const duration = Date.now() - startTime;
      metricsService.trackDatabaseQuery(queryName, duration, false);
      throw error;
    });
}