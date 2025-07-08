// Feature flags to control platform functionality

export const FEATURE_FLAGS = {
  // Core features
  QUIZ_ENABLED: true,
  CURRENCY_ENABLED: true,
  STORE_ENABLED: true,
  
  // Database migration flags
  USE_STUDENTS_TABLE: true, // Set to true when ready to use new students table
  
  // Background tasks
  CLEANUP_INTERVAL_MINUTES: 60, // Run cleanup less frequently
  METRICS_ENABLED: false, // Disable metrics collection
};