// Game-related constants from server/config/constants.ts
      MAX_REQUESTS: 1000
    },
    GAME_CREATION: {
      WINDOW_MS: 60 * 60 * 1000, // 1 hour
      MAX_REQUESTS: 20
    },
    PASSWORD_RESET: {
      WINDOW_MS: 60 * 60 * 1000, // 1 hour
      MAX_REQUESTS: 3
    },
    WS_CONNECTION: {
      WINDOW_MS: 60 * 1000, // 1 minute
      MAX_REQUESTS: 10
--
    DB_IDLE: 30000, // 30 seconds
    SLOW_REQUEST_THRESHOLD: 1000, // 1 second
    WEBSOCKET_HEARTBEAT: 120000, // 2 minutes
    RATE_LIMIT_CLEANUP: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_EXPIRY: 5 * 60 * 1000 // 5 minutes
  },
  
  CACHE: {
    DEFAULT_TTL: 300, // 5 minutes in seconds
    PROFILE_TTL: 300, // 5 minutes in seconds
    SIGNED_URL_TTL: 3600, // 1 hour in seconds
    REDIS_MAX_RECONNECT_ATTEMPTS: 10,
    REDIS_RECONNECT_BASE_DELAY: 100, // 100ms
