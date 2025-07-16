import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

export function initSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      // Automatically instrument Node.js libraries and frameworks
      ...Sentry.getDefaultIntegrations(),
      // Performance profiling
      nodeProfilingIntegration(),
    ],
    
    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in production, 100% in dev
    profilesSampleRate: 0.1, // 10% of traces will have profiling
    
    // Release tracking
    release: process.env.APP_VERSION || "development",
    environment: process.env.NODE_ENV || "development",
    
    // Server name for better organization
    serverName: "animal-genius-backend",
    
    // Ignore certain errors
    ignoreErrors: [
      // Ignore client disconnections
      'ECONNRESET',
      'EPIPE',
      'ETIMEDOUT',
    ],
    
    // Data scrubbing for privacy
    beforeSend(event, hint) {
      // Remove sensitive student data
      if (event.request?.data) {
        // Remove passport codes from request data
        const data = event.request.data;
        if (typeof data === 'object') {
          Object.keys(data).forEach(key => {
            if (key.toLowerCase().includes('passport') || key.toLowerCase().includes('code')) {
              data[key] = '[REDACTED]';
            }
          });
        }
      }
      
      // Remove passport codes from URLs
      if (event.request?.url) {
        event.request.url = event.request.url.replace(/[A-Z]{3}-[A-Z0-9]{3}/g, '[PASSPORT]');
      }
      
      // Remove student names from error messages
      if (event.exception?.values) {
        event.exception.values.forEach(exception => {
          if (exception.value) {
            exception.value = exception.value.replace(/[A-Z]{3}-[A-Z0-9]{3}/g, '[PASSPORT]');
          }
        });
      }
      
      return event;
    },
  });
}