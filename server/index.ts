import express from "express";
import { env } from "./config/env";
import { registerRoutes } from "./routes";
import path from "path";
import { fileURLToPath } from "url";
import { startPerformanceLogging, resetAuthMetrics } from "./middleware/auth-monitor";
import cookieParser from "cookie-parser";
import { db, pool } from "./db";
import { sql } from "drizzle-orm";
import { metricsService } from "./monitoring/metrics-service";
import { cleanupManager, registerProcessHandlers } from "./lib/resource-cleanup";
import { apiLimiter } from "./middleware/rateLimiter";
import cors from "cors";
import { setCacheHeaders } from "./middleware/cache-headers";
import { requestIdMiddleware, errorHandler, notFoundHandler } from "./middleware/error-handler";
import { httpMetricsMiddleware } from "./middleware/observability";
import { jsonLogger } from "./lib/json-logger";
import helmet from "helmet";
import * as Sentry from "@sentry/node";
// Vite imports removed - frontend is now separate

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple logging function that uses JSON logger
function log(message: string) {
  jsonLogger.info(message, { service: 'express' });
}

// Register all cleanup handlers
function registerCleanupHandlers(server: any, _app: express.Express) {
  // Database pool cleanup
  cleanupManager.register({
    name: 'database-pool',
    priority: 100, // Close late to allow other handlers to use DB
    handler: async () => {
      log('Closing database pool...');
      await pool.end();
      log('Database pool closed');
    },
    timeout: 5000
  });


  // Metrics service cleanup
  cleanupManager.register({
    name: 'metrics-service',
    priority: 40,
    handler: () => {
      log('Cleaning up metrics service...');
      metricsService.cleanup();
    }
  });

  // HTTP server cleanup
  cleanupManager.register({
    name: 'http-server',
    priority: 90, // Close near the end
    handler: () => new Promise<void>((resolve, reject) => {
      log('Closing HTTP server...');
      server.close((err?: Error) => {
        if (err) {
          log('Error closing server: ' + err.message);
          reject(err);
        } else {
          log('HTTP server closed');
          resolve();
        }
      });
    }),
    timeout: 8000
  });
}

const app = express();

// Initialize Sentry before other middleware
// Sentry is now initialized in instrument.ts via --import flag

// Configure CORS
// SECURITY: Only allow specific origins in production
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://animal-genius-frontend.vercel.app',
  'https://animal-genius-quiz-pro.vercel.app',
  env.FRONTEND_URL
].filter(Boolean) as string[];

if (env.NODE_ENV === 'production') {
  jsonLogger.info('CORS configured for production', { origins: allowedOrigins });
}

// Apply security headers with Helmet
// Using report-only mode for beta to identify needed external resources
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", ...allowedOrigins],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
    reportOnly: true, // Report violations but don't enforce during beta
  },
  crossOriginEmbedderPolicy: false, // May need to be false for some assets
}));

app.use(cors({
  credentials: true, // Allow cookies to be sent
  origin: (origin, callback) => {
    // Only log CORS rejections, not every check
    
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // For local development ONLY, allow file:// protocol
      if (env.NODE_ENV === 'development' && origin && origin.startsWith('file://')) {
        jsonLogger.debug('CORS allowed file:// origin in development mode', { origin });
        callback(null, true);
      } else {
        jsonLogger.warn('CORS blocked origin', { origin });
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-passport-code']
}));

// Trust proxy for rate limiting to work properly behind Render's load balancer
app.set('trust proxy', 1);

// Cookie parsing middleware (MUST be before routes that use cookies)
app.use(cookieParser());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Add request ID middleware early in the chain
app.use(requestIdMiddleware);

// Add observability middleware for metrics and structured logging
app.use(httpMetricsMiddleware);

// Apply cache headers middleware
app.use(setCacheHeaders);

// Serve static files from public directory
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Apply general rate limiting to all routes EXCEPT health endpoints
app.use((req, res, next) => {
  // Skip rate limiting for health endpoints
  if (req.path.startsWith('/api/health') || req.path.startsWith('/health')) {
    return next();
  }
  apiLimiter(req, res, next);
});

app.use((req, res, next) => {
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    try {
      // Test if the response can be serialized
      JSON.stringify(bodyJson);
      return originalResJson.apply(res, [bodyJson, ...args]);
    } catch (error) {
      jsonLogger.error('Failed to serialize response', error, {
        responseType: typeof bodyJson,
        responseKeys: bodyJson && typeof bodyJson === 'object' ? Object.keys(bodyJson) : undefined
      });
      // Send error response instead
      res.status(500);
      return originalResJson.apply(res, [{ message: 'Internal server error: Response serialization failed' }, ...args]);
    }
  };

  next();
});

(async () => {
  try {
    // Register process handlers early
    registerProcessHandlers();
    
    // Test database connection before starting server
    log("Testing database connection...");
    await db.execute(sql`SELECT 1`);
    log("Database connection successful");

    const server = await registerRoutes(app);

    // 404 handler - must come after all routes
    app.use(notFoundHandler);

    // Sentry error handler must be before any other error middleware
    Sentry.setupExpressErrorHandler(app);

    // Global error handler - must be last
    app.use(errorHandler);

    // Frontend is now served separately via Vite dev server or Vercel
    // No need to serve static files from backend

    // Use PORT from validated environment
    const portNumber = env.PORT;
    server.listen(portNumber, "0.0.0.0", () => {
      log(`serving on port ${portNumber}`);
      
      // Reset and start authentication performance monitoring
      resetAuthMetrics(); // Clear old metrics on startup
      startPerformanceLogging();
      log('Authentication performance monitoring started');
      
      // Register cleanup handlers
      registerCleanupHandlers(server, app);
    });
  } catch (error) {
    jsonLogger.error("Failed to start server", error);
    
    // If it's a database connection error, provide more specific guidance
    if (error && typeof error === 'object' && 'code' in error) {
      jsonLogger.error("Database connection issue detected", error, {
        errorCode: error.code,
        guidance: [
          "1. DATABASE_URL environment variable is set correctly",
          "2. Database is accessible and running",
          "3. Network connectivity to the database"
        ]
      });
    }
    
    process.exit(1);
  }
})();
