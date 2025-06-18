// Temporary configuration to disable unused features
// Add this to your server startup or environment config

export const FEATURE_FLAGS = {
  // Disable real-time game features
  GAMES_ENABLED: false,
  WEBSOCKET_ENABLED: false,
  
  // Keep core features
  QUIZ_ENABLED: true,
  CURRENCY_ENABLED: true,
  STORE_ENABLED: true,
  
  // Reduce background tasks
  CLEANUP_INTERVAL_MINUTES: 60, // Run cleanup less frequently
  METRICS_ENABLED: false, // Disable metrics collection
};

// Use in your server/index.ts:
// if (FEATURE_FLAGS.WEBSOCKET_ENABLED) {
//   const gameWebSocketServer = new GameWebSocketServer(httpServer);
// }
