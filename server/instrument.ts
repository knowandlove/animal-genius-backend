import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// Initialize Sentry before anything else
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  enabled: process.env.NODE_ENV === 'production' && !!process.env.SENTRY_DSN,
  integrations: [
    // Automatically instrument Node.js libraries and frameworks
    ...Sentry.getDefaultIntegrations({}),
    nodeProfilingIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
  
  // Privacy and security settings
  beforeSend(event, _hint) {
    // Don't send events in development
    if (process.env.NODE_ENV !== 'production') {
      return null;
    }
    
    // Scrub sensitive data
    if (event.request) {
      // Remove auth headers
      if (event.request.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['x-passport-code'];
        delete event.request.headers['cookie'];
      }
      
      // Scrub sensitive query params
      if (event.request.query_string && typeof event.request.query_string === 'string') {
        event.request.query_string = event.request.query_string
          .replace(/passportCode=[^&]+/gi, 'passportCode=[REDACTED]')
          .replace(/token=[^&]+/gi, 'token=[REDACTED]');
      }
    }
    
    // Scrub user data
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
      delete event.user.ip_address;
    }
    
    return event;
  },
});