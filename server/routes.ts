import type { Express } from "express";
import { createServer, type Server } from "http";
import { Request, Response } from "express";
import { GameWebSocketServer } from "./websocket-server";
import { gameSessionManager } from "./game-session-manager";
import { getRandomQuestions } from "@shared/animal-facts-questions";
import { GameSettings } from "@shared/game-types";
import { authLimiter, gameCreationLimiter } from "./middleware/rateLimiter";
import { handleImportStudents, uploadCSV } from "./routes/import-students";
import { wsAuthManager } from "./websocket-auth";
import { metricsService } from "./monitoring/metrics-service";
import { registerRoomRoutes } from "./routes/room";
import { registerSecureRoomRoutes } from "./routes/room-secure";
import { registerRoomSettingsRoutes } from "./routes/room-settings";
import { registerClassIslandRoutes } from "./routes/class-island";
import { registerPurchaseApprovalRoutes } from "./routes/purchase-approvals";
import { registerStoreManagementRoutes } from "./routes/store-management";
import { registerItemPositionRoutes } from "./routes/item-positions";
import { registerNormalizedItemPositionRoutes } from "./routes/item-positions-normalized";
import { registerStoreAdminRoutes } from "./routes/store/admin";
import { requireAuth, authenticateAdmin } from "./middleware/auth";
import authRoutes from "./routes/auth";
import meRoutes from './routes/me';
import assetsRouter from './routes/admin/assets-direct';
import storeRouter from './routes/store';
import adminUploadRoutes from "./routes/admin/upload-asset";
import monitoringRoutes from "./routes/admin/monitoring";
import quickStatsRoutes from "./routes/admin/quick-stats";
import debugStoreRouter from './routes/debug-store';
import storeDirectRouter from './routes/store-direct';
import classesRouter from './routes/classes';
import quizRouter from './routes/quiz';
import analyticsRouter from './routes/analytics';
import currencyRouter from './routes/currency';
import adminRouter from './routes/admin';
import submissionsRouter from './routes/submissions';

// Feature flags to disable unused features
const FEATURE_FLAGS = {
  GAMES_ENABLED: process.env.GAMES_ENABLED !== 'false',
  WEBSOCKET_ENABLED: process.env.WEBSOCKET_ENABLED !== 'false',
  METRICS_ENABLED: process.env.METRICS_ENABLED !== 'false',
  STORE_APPROVAL_REQUIRED: process.env.STORE_APPROVAL_REQUIRED === 'true', // Default to false (direct purchase)
};

export async function registerRoutes(app: Express): Promise<Server> {

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", websocket: "ready" });
  });

  // Register student room routes (no auth required)
  registerRoomRoutes(app);
  
  // Register secure student room routes (session-based auth)
  registerSecureRoomRoutes(app);
  
  // Register room settings routes
  registerRoomSettingsRoutes(app);
  
  // Register class island routes
  registerClassIslandRoutes(app);
  
  // Register the new /api/me endpoint
  app.use('/api', meRoutes);
  
  // Use new Supabase auth routes
  app.use('/api/auth', authRoutes);
  
  // Test endpoint to verify auth is working
  app.get("/api/test-auth", requireAuth, async (req: Request, res: Response) => {
    res.json({ 
      success: true, 
      user: req.user,
      profile: {
        id: req.profile?.id,
        fullName: req.profile?.fullName,
        email: req.profile?.email,
        isAdmin: req.profile?.isAdmin
      }
    });
  });

  // ==================== MODULAR ROUTES ====================
  
  // Classes routes
  app.use('/api/classes', classesRouter);
  
  // Quiz routes
  app.use('/api/quiz', quizRouter);
  
  // Analytics routes
  app.use('/api', analyticsRouter);
  
  // Currency routes
  app.use('/api/currency', currencyRouter);
  
  // Admin routes
  app.use('/api/admin', adminRouter);
  
  // Submissions routes
  app.use('/api/submissions', submissionsRouter);
  
  // ==================== LEGACY ROUTES ====================
  
  // Import students from CSV (special case with upload middleware)
  app.post("/api/classes/:id/import-students", requireAuth, uploadCSV, handleImportStudents);

  // ==================== STORE ROUTES ====================
  
  if (FEATURE_FLAGS.STORE_APPROVAL_REQUIRED) {
    // Register purchase approval routes (teacher auth required)
    registerPurchaseApprovalRoutes(app);
  }
  
  // Register store management routes (teacher auth required)
  registerStoreManagementRoutes(app);
  
  // Register item position routes (admin auth required)
  registerItemPositionRoutes(app);
  
  // Register normalized item position routes
  registerNormalizedItemPositionRoutes(app);

  // Register store admin routes
  registerStoreAdminRoutes(app);
  
  // Register asset management routes (admin only)
  app.use('/api/admin/assets', assetsRouter);
  
  // Register new store routes
  app.use('/api/store', storeRouter);
  
  // Register direct store routes (no approval required)
  app.use('/api/store-direct', storeDirectRouter);
  
  // Debug route for testing
  app.use('/api/debug/store', debugStoreRouter);
  
  // Register admin upload routes
  app.use('/api/admin', adminUploadRoutes);
  
  // Register monitoring routes
  app.use('/api/admin', monitoringRoutes);
  
  // Register quick stats routes
  app.use('/api/admin', quickStatsRoutes);
  
  // ==================== METRICS ROUTES ====================
  
  // Get WebSocket performance metrics (admin only) - if enabled
  if (FEATURE_FLAGS.METRICS_ENABLED) {
    app.get("/api/admin/metrics", authenticateAdmin, async (req: any, res) => {
      try {
        const metrics = metricsService.getCurrentMetrics();
        res.json(metrics);
      } catch (error) {
        console.error("Get metrics error:", error);
        res.status(500).json({ message: "Failed to get performance metrics" });
      }
    });

    app.get("/api/admin/metrics/summary", authenticateAdmin, async (req: any, res) => {
      try {
        const summary = metricsService.getMetricsSummary();
        res.json({ summary });
      } catch (error) {
        console.error("Get metrics summary error:", error);
        res.status(500).json({ message: "Failed to get metrics summary" });
      }
    });
  }

  // ==================== QUIZ GAME ROUTES ====================
  
  if (FEATURE_FLAGS.GAMES_ENABLED) {
    // Get WebSocket authentication ticket
    app.post("/api/ws/auth", requireAuth, async (req: any, res) => {
      try {
        const { gameId } = req.body;
        
        // Generate ticket for authenticated user
        const wsTicket = wsAuthManager.generateTicket(req.user.userId, gameId);
        
        res.json({
          wsTicket,
          expiresIn: 30 // seconds
        });
      } catch (error) {
        console.error("WebSocket auth error:", error);
        res.status(500).json({ message: "Failed to generate WebSocket ticket" });
      }
    });
    
    // Create a new game session
    app.post("/api/games/create", requireAuth, gameCreationLimiter, async (req: any, res) => {
      try {
        const { mode = 'team', questionCount = 16 } = req.body;
        
        // Validate inputs
        if (!['team', 'individual'].includes(mode)) {
          return res.status(400).json({ message: "Invalid game mode" });
        }
        
        const validatedQuestionCount = Math.min(Math.max(parseInt(questionCount) || 16, 5), 30);
        
        const settings: GameSettings = {
          mode,
          questionCount: validatedQuestionCount,
          timePerQuestion: 20
        };

        // Get random questions
        const questions = getRandomQuestions(validatedQuestionCount);
        
        // Create game session
        const game = await gameSessionManager.createGame(req.user.userId, settings, questions);
        
        // Generate WebSocket authentication ticket
        const wsTicket = wsAuthManager.generateTicket(req.user.userId, game.id);
        
        res.json({
          gameId: game.id,
          gameCode: game.code,
          settings: game.settings,
          wsTicket
        });
      } catch (error) {
        console.error("Create game error:", error);
        res.status(500).json({ message: "Failed to create game" });
      }
    });

    // Other game routes...
  } else {
    // Return 503 Service Unavailable for game endpoints when disabled
    app.use("/api/games", (req, res) => {
      res.status(503).json({ message: "Game features are currently disabled" });
    });
    app.use("/api/ws", (req, res) => {
      res.status(503).json({ message: "WebSocket features are currently disabled" });
    });
  }

  const httpServer = createServer(app);
  
  // Conditionally initialize WebSocket server based on feature flag
  if (FEATURE_FLAGS.WEBSOCKET_ENABLED && FEATURE_FLAGS.GAMES_ENABLED) {
    const gameWebSocketServer = new GameWebSocketServer(httpServer);
    
    // Store reference for cleanup
    (app as any).gameWebSocketServer = gameWebSocketServer;
    
    console.log('✅ WebSocket server enabled for games');
  } else {
    console.log('⏸️  WebSocket server disabled');
  }
  
  return httpServer;
}