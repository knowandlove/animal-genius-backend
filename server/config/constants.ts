/**
 * Centralized configuration constants for the Animal Genius Backend
 * All magic numbers and configurable values should be defined here
 */

export const CONFIG = {
  RATE_LIMITS: {
    AUTH: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 5,
      SKIP_SUCCESSFUL: true
    },
    API: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 1000
    },
    // GAME_CREATION: { // Commented out - game features removed
    //   WINDOW_MS: 60 * 60 * 1000, // 1 hour
    //   MAX_REQUESTS: 20
    // },
    PASSWORD_RESET: {
      WINDOW_MS: 60 * 60 * 1000, // 1 hour
      MAX_REQUESTS: 3
    },
    // WS_CONNECTION: { // Commented out - WebSocket features removed
    //   WINDOW_MS: 60 * 1000, // 1 minute
    //   MAX_REQUESTS: 10
    // },
    STORE_PURCHASE: {
      WINDOW_MS: 5 * 60 * 1000, // 5 minutes
      MAX_REQUESTS: 10
    },
    STORE_BROWSING: {
      WINDOW_MS: 60 * 1000, // 1 minute
      MAX_REQUESTS: 60
    },
    ROOM_SAVE: {
      WINDOW_MS: 2 * 60 * 1000, // 2 minutes
      MAX_REQUESTS: 20
    },
    ROOM_BROWSING: {
      WINDOW_MS: 60 * 1000, // 1 minute
      MAX_REQUESTS: 30
    },
    PASSPORT_LOGIN: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 10
    },
    UPLOAD: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 5
    }
  },
  
  TIMEOUTS: {
    DB_CONNECTION: 8000, // 8 seconds
    DB_ACQUIRE: 10000, // 10 seconds
    DB_IDLE: 30000, // 30 seconds
    SLOW_REQUEST_THRESHOLD: 1000, // 1 second
    // WEBSOCKET_HEARTBEAT: 120000, // 2 minutes - WebSocket features removed
    RATE_LIMIT_CLEANUP: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_EXPIRY: 5 * 60 * 1000 // 5 minutes
  },
  
  CACHE: {
    DEFAULT_TTL: 300, // 5 minutes in seconds
    PROFILE_TTL: 300, // 5 minutes in seconds
    SIGNED_URL_TTL: 3600, // 1 hour in seconds
    REDIS_MAX_RECONNECT_ATTEMPTS: 10,
    REDIS_RECONNECT_BASE_DELAY: 100, // 100ms
    REDIS_RECONNECT_MAX_DELAY: 3000, // 3 seconds
    CLEANUP_INTERVAL: 120 // 2 minutes in seconds (NodeCache cleanup)
  },
  
  LOCKOUT: {
    MAX_ATTEMPTS: 5,
    DURATION_MS: 15 * 60 * 1000, // 15 minutes
    ATTEMPT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
    STATS_LOG_INTERVAL_MS: 5 * 60 * 1000 // 5 minutes
  },
  
  DATABASE: {
    POOL_MAX: 50, // Increased from 25 to handle 20 teachers × 2 connections + buffer
    POOL_MIN: 10, // Increased from 5 for better responsiveness
    IDLE_TIMEOUT_MS: 30000, // 30 seconds
    CONNECTION_TIMEOUT_MS: 8000, // 8 seconds
    ACQUIRE_TIMEOUT_MS: 10000, // 10 seconds
    STATEMENT_TIMEOUT_MS: 10000, // 10 seconds - prevent long queries from holding connections
    QUERY_TIMEOUT_MS: 10000 // 10 seconds - overall query timeout
  },
  
  MONITORING: {
    METRICS_ROLLING_WINDOW: 100,
    PERFORMANCE_LOG_INTERVAL: 60000, // 1 minute
    SESSION_CLEANUP_INTERVAL: 5 * 60 * 1000 // 5 minutes
  },
  
  FILE_LIMITS: {
    MAX_UPLOAD_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_CSV_SIZE: 5 * 1024 * 1024, // 5MB
    MAX_IMAGE_WIDTH: 800,
    MAX_IMAGE_HEIGHT: 800
  },
  
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    MIN_LIMIT: 1
  },
  
  PET_SYSTEM: {
    STATS: {
      MAX_VALUE: 100,
      MIN_VALUE: 0,
      HAPPY_THRESHOLD: 80,
      NEUTRAL_THRESHOLD: 40
    },
    TIME: {
      MS_PER_HOUR: 1000 * 60 * 60 // 1 hour in ms
    }
  },
  
  STORAGE: {
    MAX_LIST_FILES: 1000,
    BUCKET_NAMES: {
      PUBLIC_ASSETS: 'public-assets',
      STORE_ITEMS: 'store-items',
      USER_GENERATED: 'user-generated',
      AVATAR_ITEMS: 'avatar-items',
      STORE_UPLOADS: 'store-uploads',
      USER_CONTENT: 'user-content'
    }
  },
  
  QUIZ: {
    COMPLETION_REWARD: 10, // Default coins for completing a quiz
    STREAK_BONUS: 5 // Bonus coins per streak
  },
  
  SESSION: {
    STUDENT_SESSION_DURATION: '24h',
    JWT_EXPIRY: '24h'
  }
} as const;

// Type for the config to ensure type safety
export type AppConfig = typeof CONFIG;

// Helper function to get environment-specific overrides
export function getConfig(): AppConfig {
  // In the future, this could merge with environment-specific values
  // For now, just return the default config
  return CONFIG;
}