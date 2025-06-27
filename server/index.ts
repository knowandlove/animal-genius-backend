import express, { type Request, Response, NextFunction } from "express";
import { config } from "dotenv";
import { registerRoutes } from "./routes";
import path from "path";
import { fileURLToPath } from "url";
// Vite imports removed - frontend is now separate

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple logging function
function log(message: string) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [express] ${message}`);
}
import { apiLimiter } from "./middleware/rateLimiter";
import cors from "cors";
import { setCacheHeaders } from "./middleware/cache-headers";

// Load environment variables
config();

const app = express();

// Configure CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://animal-genius-frontend.vercel.app',
  'https://animal-genius-quiz-pro.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Log the origin for debugging
    console.log('CORS check - Origin:', origin);
    console.log('CORS check - Allowed origins:', allowedOrigins);
    
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // For local development, allow file:// protocol
      if (origin && origin.startsWith('file://')) {
        callback(null, true);
      } else {
        console.log('CORS BLOCKED:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Trust proxy for rate limiting to work properly in Replit
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Apply cache headers middleware
app.use(setCacheHeaders);

// Serve static files from public directory
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Apply general rate limiting to all routes
app.use(apiLimiter);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Test database connection before starting server
    log("Testing database connection...");
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`SELECT 1`);
    log("Database connection successful");

    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      log(`Error: ${message}`);
      res.status(status).json({ message });
    });

    // Frontend is now served separately via Vite dev server or Vercel
    // No need to serve static files from backend

    // Use PORT from environment or default to 5001
    const port = process.env.PORT || 5001;
    
    // Handle WebSocket upgrade - let Vite handle its own WebSocket connections
    server.on('upgrade', (request, socket, head) => {
      log(`WebSocket upgrade request from ${request.url}`);
      
      // Let Vite handle its own WebSocket connections for HMR
      if (request.url?.includes('vite') || request.url?.includes('@vite') || request.headers['sec-websocket-protocol']?.includes('vite-hmr')) {
        // Don't interfere with Vite's WebSocket handling
        return;
      }
      
      // All other WebSocket connections are handled by the GameWebSocketServer
      // which is already attached to the server in routes.ts
    });
    
    server.listen(port, "0.0.0.0", () => {
      log(`serving on port ${port}`);
      log(`WebSocket server also listening on port ${port}`);
    });
    
    // Graceful shutdown handling
    const gracefulShutdown = async () => {
      log('Starting graceful shutdown...');
      
      try {
        // Import and cleanup game session manager
        const { gameSessionManager } = await import("./game-session-manager");
        gameSessionManager.cleanup();
        log('Game session manager cleaned up');
        
        // Cleanup WebSocket server if available
        const wsServer = (app as any).gameWebSocketServer;
        if (wsServer && typeof wsServer.cleanup === 'function') {
          wsServer.cleanup();
          log('WebSocket server cleaned up');
        }
        
        // Cleanup metrics service
        const { metricsService } = await import("./monitoring/metrics-service");
        metricsService.cleanup();
        log('Metrics service cleaned up');
        
        // Close server
        server.close(() => {
          log('Server closed');
          process.exit(0);
        });
        
        // Force exit after 10 seconds
        setTimeout(() => {
          log('Forcing shutdown after timeout');
          process.exit(1);
        }, 10000);
      } catch (error) {
        log('Error during shutdown:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    };
    
    // Handle shutdown signals
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    console.error("Failed to start server:", error);
    
    // If it's a database connection error, provide more specific guidance
    if (error && typeof error === 'object' && 'code' in error) {
      console.error("Database error code:", error.code);
      console.error("This appears to be a database connection issue. Please check:");
      console.error("1. DATABASE_URL environment variable is set correctly");
      console.error("2. Database is accessible and running");
      console.error("3. Network connectivity to the database");
    }
    
    process.exit(1);
  }
})();
