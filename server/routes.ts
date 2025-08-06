import type { Express } from "express";
import { createServer, type Server } from "http";
import { Request, Response } from "express";
import { handleImportStudents, uploadCSV } from "./routes/import-students";
import { metricsService } from "./monitoring/metrics-service";
import { metricsEndpoint } from "./middleware/observability";
import { registerRoomRoutes } from "./routes/room";
import { registerSecureRoomRoutes } from "./routes/room-secure";
import { registerRoomSettingsRoutes } from "./routes/room-settings";
import { registerClassIslandRoutes } from "./routes/class-island";
import { registerStoreManagementRoutes } from "./routes/store-management";
import { registerItemPositionRoutes } from "./routes/item-positions";
import { registerNormalizedItemPositionRoutes } from "./routes/item-positions-normalized";
import { registerStoreAdminRoutes } from "./routes/store/admin";
import { requireAuth, requireAdmin } from "./middleware/auth";
import authRoutes from "./routes/auth";
import unifiedAuthRoutes from "./routes/unified-auth";
import meRoutes from './routes/me';
import assetsRouter from './routes/admin/assets-direct';
import storeRouter from './routes/store';
import adminUploadRoutes from "./routes/admin/upload-asset";
import quickStatsRoutes from "./routes/admin/quick-stats";
import storeDirectRouter from './routes/store-direct';
import classesRouter from './routes/classes';
import quizRouter from './routes/quiz';
import analyticsRouter from './routes/analytics';
import currencyRouter from './routes/currency';
import adminRouter from './routes/admin';
import submissionsRouter from './routes/submissions';
import quizSubmissionDetailsRouter from './routes/quiz-submission-details';
import patternsRouter from './routes/patterns';
import { registerStudentApiRoutes } from './routes/student-api';
import studentPassportRouter from './routes/student-passport-api';
import lessonsRouter from './routes/lessons';
import petsRouter from './routes/pets';
import adminPetsRouter from './routes/admin/pets';
import { registerRoomViewerRoutes } from './routes/room-viewers';
import healthRouter from './routes/health';
import jobsRouter from './routes/jobs';
import monitoringRouter from './routes/monitoring';
import httpMetricsRouter from './routes/admin/http-metrics';
import gameScoresRouter from './routes/game-scores';
import classValuesRouter from './routes/class-values';
import classSettingsRouter from './routes/class-settings';
import { registerRoomVisitRoutes } from './routes/room-visits';
import { registerRoomGuestbookRoutes } from './routes/room-guestbook';
import { registerStudentAchievementRoutes } from './routes/student-achievements';
import communityRouter from './routes/community/index.js';
import gameAIRouter from './routes/game-ai';
import { avatarProcessor } from './routes/avatar-processor';
// v2 Feature - Garden import disabled
// import gardenRouter from './routes/garden.js';

// Feature flags to disable unused features
const FEATURE_FLAGS = {
  METRICS_ENABLED: process.env.METRICS_ENABLED !== 'false',
};

export async function registerRoutes(app: Express): Promise<Server> {

  // Health check endpoints
  app.use('/api/health', healthRouter);
  
  // Background job status endpoints
  app.use('/api/jobs', jobsRouter);
  

  // Register student room routes (no auth required)
  registerRoomRoutes(app);
  
  // Register room viewer tracking routes
  registerRoomViewerRoutes(app);
  
  // Register room visit tracking routes (for achievements and analytics)
  registerRoomVisitRoutes(app);
  
  // Register room guestbook routes (for visitor messages)
  registerRoomGuestbookRoutes(app);
  
  // Register student achievement routes (for achievement system)
  registerStudentAchievementRoutes(app);
  
  // Register secure student room routes (session-based auth)
  registerSecureRoomRoutes(app);
  
  // Register room settings routes
  registerRoomSettingsRoutes(app);
  
  // Register class island routes
  registerClassIslandRoutes(app);
  
  // Register student API routes
  registerStudentApiRoutes(app);
  
  // Register the new /api/me endpoint
  app.use('/api', meRoutes);
  
  // Use new Supabase auth routes
  app.use('/api/auth', authRoutes);
  
  // Unified auth routes (JIT provisioning)
  app.use('/api/unified-auth', unifiedAuthRoutes);
  
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
  
  // Class settings routes
  app.use('/api/classes', classSettingsRouter);
  
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
  
  // Quiz submission details routes (for realtime)
  app.use('/api/quiz-submissions', quizSubmissionDetailsRouter);
  
  // Lessons routes
  app.use('/api/classes', lessonsRouter);
  
  // Student Passport API routes (for anonymous auth)
  app.use('/api/student-passport', studentPassportRouter);
  
  // Avatar processing routes (server-side SVG processing)
  app.use('/api/avatar', avatarProcessor);
  
  // ==================== LEGACY ROUTES ====================
  
  // Import students from CSV (special case with upload middleware)
  app.post("/api/classes/:id/import-students", requireAuth, uploadCSV, handleImportStudents);

  // ==================== STORE ROUTES ====================
  
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
  
  // Register patterns routes (to be deprecated)
  app.use('/api/patterns', patternsRouter);
  
  // v2 Feature - Garden routes temporarily disabled
  // app.use('/api/garden', gardenRouter);
  
  // Register pet routes
  console.log('📍 Registering pets router at /api/pets');
  app.use('/api/pets', petsRouter);
  console.log('✅ Pets router registered');
  
  // Register admin pet management routes
  app.use('/api/admin/pets', adminPetsRouter);
  
  // Register game scores routes
  app.use(gameScoresRouter);
  
  // Register class values voting routes
  app.use('/api/class-values', classValuesRouter);
  
  // Register community hub routes
  app.use('/api/community', communityRouter);
  app.use('/api/ai', gameAIRouter);
  
  // Register admin upload routes
  app.use('/api/admin', adminUploadRoutes);
  
  // Register quick stats routes
  app.use('/api/admin', quickStatsRoutes);
  
  // ==================== METRICS ROUTES ====================
  
  // Get performance metrics (admin only) - if enabled
  if (FEATURE_FLAGS.METRICS_ENABLED) {
    app.get("/api/admin/metrics", requireAuth, requireAdmin, metricsEndpoint);

    app.get("/api/admin/metrics/summary", requireAuth, requireAdmin, (req: any, res) => {
      const summary = metricsService.getMetricsSummary();
      res.json({ summary });
    });
    
    // HTTP metrics sub-routes
    app.use('/api/admin/metrics', httpMetricsRouter);
  }
  
  // Error tracking routes (moved to admin)
  app.use('/api/admin/errors', monitoringRouter);
  
  // Health check routes
  app.use('/api/health', healthRouter);
  
  // Job status routes (for background tasks)
  app.use('/api/jobs', jobsRouter);


  const httpServer = createServer(app);
  
  return httpServer;
}