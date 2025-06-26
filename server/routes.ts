import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { uuidStorage, generateUniqueClassCodeSupabase } from "./storage-uuid-fixes";
import { insertClassSchema, insertQuizSubmissionSchema, insertLessonProgressSchema } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import { gameSessionManager } from "./game-session-manager";
import { GameWebSocketServer } from "./websocket-server";
import { getRandomQuestions } from "@shared/animal-facts-questions";
import { GameSettings } from "@shared/game-types";
import { authLimiter, gameCreationLimiter, passwordResetLimiter } from "./middleware/rateLimiter";
import { handleImportStudents, uploadCSV } from "./routes/import-students";
import { validateBody, validateParams, schemas } from "./middleware/validation";
import { wsAuthManager } from "./websocket-auth";
import { metricsService } from "./monitoring/metrics-service";
import { registerIslandRoutes } from "./routes/island";
import { registerSecureIslandRoutes } from "./routes/island-secure";
import { registerPurchaseApprovalRoutes } from "./routes/purchase-approvals";
import { registerStoreManagementRoutes } from "./routes/store-management";
import { registerItemPositionRoutes } from "./routes/item-positions";
import { registerStoreAdminRoutes } from "./routes/store/admin";
import { requireAuth, authenticateAdmin } from "./middleware/auth";
import authRoutes from "./routes/auth";
import meRoutes from './routes/me';
// import storeRoutes from "./routes/store"; // OLD SYSTEM - commented out
import assetsRouter from './routes/admin/assets-direct';
import storeRouter from './routes/store';
import adminUploadRoutes from "./routes/admin/upload-asset";
import monitoringRoutes from "./routes/admin/monitoring";
import quickStatsRoutes from "./routes/admin/quick-stats";
import debugStoreRouter from './routes/debug-store';
import emergencyLoginRouter from './routes/emergency-login';

// Feature flags to disable unused features
const FEATURE_FLAGS = {
  GAMES_ENABLED: process.env.GAMES_ENABLED !== 'false', // Default true for backward compatibility
  WEBSOCKET_ENABLED: process.env.WEBSOCKET_ENABLED !== 'false',
  METRICS_ENABLED: process.env.METRICS_ENABLED !== 'false',
};

// JWT is now handled by Supabase Auth

// Helper function for safe parseInt validation
function safeParseInt(value: string, paramName: string): number {
  const parsed = parseInt(value, 10);
  
  if (isNaN(parsed)) {
    throw new Error(`Invalid ${paramName}: must be a valid integer`);
  }
  
  return parsed;
}

// Alternative helper that returns null instead of throwing
function tryParseInt(value: string): number | null {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

/* 
 * Usage pattern for remaining parseInt calls:
 * 
 * 1. Replace: const id = parseInt(req.params.id);
 *    With:    const id = safeParseInt(req.params.id, 'descriptive name');
 * 
 * 2. Update the catch block to handle validation errors:
 *    catch (error: any) {
 *      if (error.message?.includes('Invalid')) {
 *        res.status(400).json({ message: error.message });
 *      } else {
 *        res.status(500).json({ message: "Failed to..." });
 *      }
 *    }
 * 
 * 3. For optional parameters, use tryParseInt() and check for null
 */

// Admin middleware is now imported from ./middleware/auth

export async function registerRoutes(app: Express): Promise<Server> {

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", websocket: "ready" });
  });

  // Register student island routes (no auth required)
  registerIslandRoutes(app);
  
  // Register secure student island routes (session-based auth)
  registerSecureIslandRoutes(app);
  
  // Register the new /api/me endpoint
  app.use('/api', meRoutes);
  
  // Use new Supabase auth routes
  app.use('/api/auth', authRoutes);
  
  // TEMPORARY: Emergency login for migration period
  app.use('/api', emergencyLoginRouter);
  
  // Test endpoint to verify auth is working
  app.get("/api/test-auth", requireAuth, async (req: any, res) => {
    console.log("[/api/test-auth] User:", req.user);
    console.log("[/api/test-auth] Profile:", req.profile);
    res.json({ 
      success: true, 
      user: req.user,
      profile: {
        id: req.profile?.id,
        firstName: req.profile?.first_name,
        lastName: req.profile?.last_name,
        email: req.profile?.email
      }
    });
  });

  // Create class
  app.post("/api/classes", requireAuth, async (req: any, res) => {
    try {
      console.log("[/api/classes POST] Request body:", req.body);
      console.log("[/api/classes POST] User:", req.user);
      
      const classData = insertClassSchema.parse(req.body);
      console.log("[/api/classes POST] Parsed class data:", classData);
      
      // Generate unique class code
      const code = await generateUniqueClassCodeSupabase();
      console.log("[/api/classes POST] Generated code:", code);
      
      // Use UUID-compatible storage method
      const newClass = await uuidStorage.createClass({
        ...classData,
        teacherId: req.user.userId,
        code
      });
      console.log("[/api/classes POST] Created class:", newClass);
      
      res.json(newClass);
    } catch (error) {
      console.error("[/api/classes POST] Create class error:", error);
      if (error instanceof Error) {
        console.error("[/api/classes POST] Error message:", error.message);
        console.error("[/api/classes POST] Error stack:", error.stack);
      }
      res.status(400).json({ message: "Failed to create class", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Get teacher's classes
  app.get("/api/classes", requireAuth, async (req: any, res) => {
    try {
      console.log("[/api/classes] User ID:", req.user?.userId);
      
      if (!req.user?.userId) {
        console.error("[/api/classes] No user ID in request");
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Use UUID-compatible storage method
      const classes = await uuidStorage.getClassesByTeacherId(req.user.userId);
      console.log(`[/api/classes] Found ${classes.length} classes for user ${req.user.userId}`);
      
      // Get submission counts for each class
      const classesWithStats = await Promise.all(
        classes.map(async (cls) => {
          const stats = await storage.getClassStats(cls.id);
          return {
            ...cls,
            submissionCount: stats.totalSubmissions,
          };
        })
      );
      
      res.json(classesWithStats);
    } catch (error) {
      console.error("[/api/classes] Error:", error);
      console.error("[/api/classes] Stack:", error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ message: "Failed to get classes" });
    }
  });

  // Get individual class by ID
  app.get("/api/classes/:id", requireAuth, validateParams(schemas.idParam), async (req: any, res) => {
    try {
      const classId = req.params.id;
      const teacherId = req.user.userId;
      
      const classRecord = await storage.getClassById(classId);
      
      if (!classRecord || classRecord.teacherId !== teacherId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(classRecord);
    } catch (error: any) {
      console.error("Get class error:", error);
      if (error.message?.includes('Invalid class ID')) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to get class" });
      }
    }
  });

  // Get class by code (for students)
  app.get("/api/classes/code/:code", validateParams(schemas.classCodeParam), async (req, res) => {
    try {
      const { code } = req.params;
      const classRecord = await storage.getClassByCode(code);
      
      if (!classRecord) {
        return res.status(404).json({ message: "Class not found" });
      }
      
      const teacher = await storage.getUserById(classRecord.teacherId);
      
      res.json({
        ...classRecord,
        teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : "Unknown Teacher",
      });
    } catch (error) {
      console.error("Get class by code error:", error);
      res.status(500).json({ message: "Failed to get class" });
    }
  });

  // Submit quiz - OPTIMIZED VERSION
  app.post("/api/quiz/submit", async (req, res) => {
    try {
      const submission = insertQuizSubmissionSchema.parse(req.body);
      
      // Use the optimized method for fast submission
      const result = await storage.createQuizSubmissionOptimized(submission);
      
      // Return immediately - rewards will be processed async
      res.json(result);
    } catch (error) {
      console.error("Submit quiz error:", error);
      res.status(400).json({ message: "Failed to submit quiz" });
    }
  });

  // Submit quiz submissions (alternative endpoint) - OPTIMIZED VERSION
  app.post("/api/quiz-submissions", async (req, res) => {
    try {
      // Validate required fields
      if (!req.body.studentName?.trim()) {
        return res.status(400).json({ message: "Student name is required" });
      }
      if (!req.body.gradeLevel?.trim()) {
        return res.status(400).json({ message: "Grade level is required" });
      }
      if (!req.body.classId) {
        return res.status(400).json({ message: "Class ID is required" });
      }
      
      // Verify class exists
      const classExists = await storage.getClassById(req.body.classId);
      if (!classExists) {
        return res.status(404).json({ message: "Class not found" });
      }
      
      const submission = insertQuizSubmissionSchema.parse(req.body);
      
      // Use the optimized method for fast submission
      const result = await storage.createQuizSubmissionOptimized(submission);
      
      // Return immediately - rewards will be processed async
      res.json(result);
    } catch (error: any) {
      console.error("Submit quiz submission error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to submit quiz";
      res.status(400).json({ message: errorMessage });
    }
  });

  // Get class analytics
  app.get("/api/classes/:id/analytics", requireAuth, async (req: any, res) => {
    try {
      const classId = safeParseInt(req.params.id, 'class ID');
      const classRecord = await storage.getClassById(classId);
      
      if (!classRecord || classRecord.teacherId !== req.user.userId) {
        return res.status(404).json({ message: "Class not found" });
      }
      
      const stats = await storage.getClassStats(classId);
      const submissions = await storage.getSubmissionsByClassId(classId);
      
      // Import pairing service functions
      const { calculateGeniusDistribution, generateClassInsights } = await import("./services/pairingService");
      
      // Calculate genius distribution and insights
      const geniusDistribution = calculateGeniusDistribution(submissions);
      const insights = generateClassInsights(submissions);
      
      res.json({
        class: classRecord,
        stats: {
          ...stats,
          geniusDistribution
        },
        insights,
        submissions,
      });
    } catch (error: any) {
      console.error("Get analytics error:", error);
      if (error.message?.includes('Invalid class ID')) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to get analytics" });
      }
    }
  });

  // Get live submissions for real-time discovery board
  app.get("/api/classes/:id/live-submissions", requireAuth, async (req: any, res) => {
    try {
      const classId = safeParseInt(req.params.id, 'class ID');
      const classRecord = await storage.getClassById(classId);
      
      if (!classRecord || classRecord.teacherId !== req.user.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Get submissions from last 2 hours (active session)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const submissions = await storage.getSubmissionsByClassId(classId);
      
      // Filter to recent submissions and format for live board
      const liveSubmissions = submissions
        .filter(sub => sub.completedAt && new Date(sub.completedAt) >= twoHoursAgo)
        .map(sub => ({
          studentName: sub.studentName,
          animalType: sub.animalType,
          timestamp: sub.completedAt
        }))
        .sort((a, b) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeA - timeB;
        });
      
      res.json(liveSubmissions);
    } catch (error: any) {
      console.error("Get live submissions error:", error);
      if (error.message?.includes('Invalid class ID')) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to get live submissions" });
      }
    }
  });

  // Get class pairings
  app.get("/api/classes/:id/pairings", requireAuth, async (req: any, res) => {
    try {
      const classId = safeParseInt(req.params.id, 'class ID');
      const classRecord = await storage.getClassById(classId);
      
      if (!classRecord || classRecord.teacherId !== req.user.userId) {
        return res.status(404).json({ message: "Class not found" });
      }
      
      const submissions = await storage.getSubmissionsByClassId(classId);
      
      // Import pairing service functions
      const { generatePairings } = await import("./services/pairingService");
      
      // Generate pairings
      const pairings = generatePairings(submissions);
      
      res.json(pairings);
    } catch (error: any) {
      console.error("Get pairings error:", error);
      if (error.message?.includes('Invalid class ID')) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to get pairings" });
      }
    }
  });

  // Get submission by ID
  app.get("/api/submissions/:id", requireAuth, async (req: any, res) => {
    try {
      const submissionId = safeParseInt(req.params.id, 'submission ID');
      const submission = await storage.getSubmissionById(submissionId);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }
      
      // Get class info to verify teacher access
      const classRecord = await storage.getClassById(submission.classId);
      if (!classRecord || classRecord.teacherId !== req.user.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json({
        ...submission,
        class: classRecord
      });
    } catch (error: any) {
      console.error("Get submission error:", error);
      if (error.message?.includes('Invalid submission ID')) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to get submission" });
      }
    }
  });

  // Delete submission
  app.delete("/api/submissions/:id", requireAuth, async (req: any, res) => {
    try {
      const submissionId = safeParseInt(req.params.id, 'submission ID');
      const submission = await storage.getSubmissionById(submissionId);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }
      
      // Get class info to verify teacher access
      const classRecord = await storage.getClassById(submission.classId);
      if (!classRecord || classRecord.teacherId !== req.user.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteSubmission(submissionId);
      res.json({ message: "Submission deleted successfully" });
    } catch (error: any) {
      console.error("Delete submission error:", error);
      if (error.message?.includes('Invalid submission ID')) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to delete submission" });
      }
    }
  });

  // Delete class
  app.delete("/api/classes/:id", requireAuth, async (req: any, res) => {
    try {
      const classId = safeParseInt(req.params.id, 'class ID');
      
      // Verify the class belongs to the authenticated teacher
      const classRecord = await storage.getClassById(classId);
      if (!classRecord || classRecord.teacherId !== req.user.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteClass(classId);
      res.status(204).end();
    } catch (error: any) {
      console.error("Delete class error:", error);
      if (error.message?.includes('Invalid')) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to delete class" });
      }
    }
  });

  // Import students from CSV
  app.post("/api/classes/:id/import-students", requireAuth, uploadCSV, handleImportStudents);

  // Lesson progress routes
  app.post("/api/classes/:classId/lessons/:id/complete", requireAuth, async (req: any, res) => {
    try {
      const lessonId = safeParseInt(req.params.id, 'lesson ID');
      const classId = safeParseInt(req.params.classId, 'class ID');
      const teacherId = req.user.userId;
      
      // Verify the class belongs to the authenticated teacher
      const classRecord = await storage.getClassById(classId);
      if (!classRecord || classRecord.teacherId !== teacherId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const progress = await storage.markLessonComplete(teacherId, classId, lessonId);
      res.json(progress);
    } catch (error: any) {
      console.error("Mark lesson complete error:", error);
      if (error.message?.includes('Invalid')) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to mark lesson complete" });
      }
    }
  });

  app.get("/api/classes/:classId/lessons/progress", requireAuth, async (req: any, res) => {
    try {
      const classId = safeParseInt(req.params.classId, 'class ID');
      const teacherId = req.user.userId;
      
      // Verify the class belongs to the authenticated teacher
      const classRecord = await storage.getClassById(classId);
      if (!classRecord || classRecord.teacherId !== teacherId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const completedLessons = await storage.getClassProgress(classId);
      res.json(completedLessons);
    } catch (error: any) {
      console.error("Get lesson progress error:", error);
      if (error.message?.includes('Invalid')) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to get lesson progress" });
      }
    }
  });

  app.get("/api/classes/:classId/lessons/:id/status", requireAuth, async (req: any, res) => {
    try {
      const lessonId = safeParseInt(req.params.id, 'lesson ID');
      const classId = safeParseInt(req.params.classId, 'class ID');
      const teacherId = req.user.userId;
      
      // Verify the class belongs to the authenticated teacher
      const classRecord = await storage.getClassById(classId);
      if (!classRecord || classRecord.teacherId !== teacherId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const isComplete = await storage.isLessonComplete(teacherId, classId, lessonId);
      res.json({ completed: isComplete });
    } catch (error: any) {
      console.error("Get lesson status error:", error);
      if (error.message?.includes('Invalid')) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to get lesson status" });
      }
    }
  });

  // Admin routes
  app.get("/api/admin/teachers", authenticateAdmin, async (req: any, res) => {
    try {
      const teachers = await storage.getAllTeachers();
      res.json(teachers);
    } catch (error) {
      console.error("Get all teachers error:", error);
      res.status(500).json({ message: "Failed to get teachers" });
    }
  });

  app.put("/api/admin/teachers/:id/admin", authenticateAdmin, async (req: any, res) => {
    try {
      const teacherId = safeParseInt(req.params.id, 'teacher ID');
      const { isAdmin } = req.body;
      
      const updatedUser = await storage.updateUserAdmin(teacherId, isAdmin);
      
      // Log admin action
      await storage.logAdminAction({
        adminId: req.user.userId,
        action: isAdmin ? 'GRANT_ADMIN' : 'REVOKE_ADMIN',
        targetUserId: teacherId,
        details: `Admin privileges ${isAdmin ? 'granted to' : 'revoked from'} user ${teacherId}`
      });
      
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Update admin status error:", error);
      if (error.message?.includes('Invalid')) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to update admin status" });
      }
    }
  });

  app.post("/api/admin/teachers/:id/reset-password", authenticateAdmin, passwordResetLimiter, async (req: any, res) => {
    try {
      const teacherId = safeParseInt(req.params.id, 'teacher ID');
      
      const newPassword = await storage.resetUserPassword(teacherId);
      
      // Log admin action
      await storage.logAdminAction({
        adminId: req.user.userId,
        action: 'RESET_PASSWORD',
        targetUserId: teacherId,
        details: `Password reset for user ${teacherId}`
      });
      
      res.json({ message: "Password reset successfully" });
      // NOTE: For production deployment, implement email service to send new password to user
      // Current implementation returns password in response for development/testing
    } catch (error: any) {
      console.error("Reset password error:", error);
      if (error.message?.includes('Invalid')) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to reset password" });
      }
    }
  });

  app.put("/api/admin/teachers/:id/school", authenticateAdmin, validateParams(schemas.idParam), validateBody(schemas.adminTeacherUpdate), async (req: any, res) => {
    try {
      const teacherId = req.params.id;
      const { schoolName } = req.body;
      
      const updatedUser = await storage.updateUserSchool(teacherId, schoolName);
      
      // Log admin action
      await storage.logAdminAction({
        adminId: req.user.userId,
        action: 'UPDATE_SCHOOL',
        targetUserId: teacherId,
        details: `School updated to "${schoolName}" for user ${teacherId}`
      });
      
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Update school error:", error);
      if (error.message?.includes('Invalid')) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to update school" });
      }
    }
  });

  app.delete("/api/admin/teachers/:id", authenticateAdmin, async (req: any, res) => {
    try {
      const teacherId = safeParseInt(req.params.id, 'teacher ID');
      
      await storage.deleteUser(teacherId);
      
      // Log admin action
      await storage.logAdminAction({
        adminId: req.user.userId,
        action: 'DELETE_USER',
        targetUserId: teacherId,
        details: `User ${teacherId} deleted`
      });
      
      res.json({ message: "User deleted successfully" });
    } catch (error: any) {
      console.error("Delete user error:", error);
      if (error.message?.includes('Invalid')) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to delete user" });
      }
    }
  });

  app.get("/api/admin/classes", authenticateAdmin, async (req: any, res) => {
    try {
      const classes = await storage.getAllClassesWithStats();
      res.json(classes);
    } catch (error) {
      console.error("Get all classes error:", error);
      res.status(500).json({ message: "Failed to get classes" });
    }
  });

  app.get("/api/admin/stats", authenticateAdmin, async (req: any, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Get admin stats error:", error);
      res.status(500).json({ message: "Failed to get admin stats" });
    }
  });

  // Get WebSocket performance metrics (admin only)
  app.get("/api/admin/metrics", authenticateAdmin, async (req: any, res) => {
    try {
      const metrics = metricsService.getCurrentMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Get metrics error:", error);
      res.status(500).json({ message: "Failed to get performance metrics" });
    }
  });

  // Get metrics summary for quick overview (admin only)
  app.get("/api/admin/metrics/summary", authenticateAdmin, async (req: any, res) => {
    try {
      const summary = metricsService.getMetricsSummary();
      res.json({ summary });
    } catch (error) {
      console.error("Get metrics summary error:", error);
      res.status(500).json({ message: "Failed to get metrics summary" });
    }
  });

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
    
    // Validate WebSocket ticket (for debugging)
    app.get("/api/ws/validate/:ticket", async (req, res) => {
      try {
        const result = wsAuthManager.validateTicket(req.params.ticket);
        res.json(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to validate ticket" });
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

    // Check if a game exists by code
    app.get("/api/games/code/:code", async (req, res) => {
      try {
        const game = gameSessionManager.getGameByCode(req.params.code.toUpperCase());
        
        if (!game) {
          return res.status(404).json({ message: "Game not found" });
        }

        res.json({
          gameId: game.id,
          status: game.status,
          playerCount: game.players.size,
          settings: game.settings
        });
      } catch (error) {
        console.error("Get game by code error:", error);
        res.status(500).json({ message: "Failed to get game" });
      }
    });

    // Get game status for teacher
    app.get("/api/games/:gameId", requireAuth, async (req: any, res) => {
      try {
        const game = gameSessionManager.getGameById(req.params.gameId);
        
        if (!game) {
          return res.status(404).json({ message: "Game not found" });
        }

        // Verify teacher owns this game
        if (game.teacherId !== req.user.userId) {
          return res.status(403).json({ message: "Not authorized" });
        }

        const players = Array.from(game.players.values());
        const leaderboard = gameSessionManager.getLeaderboard(game.id);

        res.json({
          game: {
            id: game.id,
            code: game.code,
            status: game.status,
            settings: game.settings,
            currentQuestionIndex: game.currentQuestionIndex,
            totalQuestions: game.questions.length
          },
          players,
          leaderboard
        });
      } catch (error) {
        console.error("Get game status error:", error);
        res.status(500).json({ message: "Failed to get game status" });
      }
    });

    // Get active games stats (for monitoring)
    app.get("/api/games/stats", requireAuth, async (req: any, res) => {
      try {
        const stats = gameSessionManager.getActiveGames();
        res.json(stats);
      } catch (error) {
        console.error("Get game stats error:", error);
        res.status(500).json({ message: "Failed to get game stats" });
      }
    });
  } else {
    // Return 503 Service Unavailable for game endpoints when disabled
    app.use("/api/games", (req, res) => {
      res.status(503).json({ message: "Game features are currently disabled" });
    });
    app.use("/api/ws", (req, res) => {
      res.status(503).json({ message: "WebSocket features are currently disabled" });
    });
  }

  // Currency Management Routes for Teachers
  
  // Give coins to a student
  app.post("/api/currency/give", requireAuth, async (req: any, res) => {
    try {
      const teacherId = req.user.userId;
      const { submissionId, amount, reason } = req.body;
      
      // Validate input
      if (!submissionId || !amount || amount <= 0 || amount > 1000) {
        return res.status(400).json({ message: "Invalid amount (1-1000 coins)" });
      }
      
      // Get the student submission and verify teacher owns the class
      const submission = await storage.getSubmissionById(submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      const classInfo = await storage.getClassById(submission.classId);
      if (!classInfo || classInfo.teacherId !== teacherId) {
        return res.status(403).json({ message: "Not authorized for this student" });
      }
      
      // Use transactional method to update balance and log transaction atomically
      const result = await storage.giveCurrencyWithTransaction(
        submissionId,
        amount,
        teacherId,
        reason || 'Teacher bonus'
      );
      
      res.json({ 
        success: true, 
        newBalance: result.newBalance,
        message: `Gave ${amount} coins to ${submission.studentName}` 
      });
    } catch (error) {
      console.error("Give currency error:", error);
      res.status(500).json({ message: "Failed to give currency" });
    }
  });
  
  // Take coins from a student
  app.post("/api/currency/take", requireAuth, async (req: any, res) => {
    try {
      const teacherId = req.user.userId;
      const { submissionId, amount, reason } = req.body;
      
      // Validate input
      if (!submissionId || !amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }
      
      // Get the student submission and verify teacher owns the class
      const submission = await storage.getSubmissionById(submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      const classInfo = await storage.getClassById(submission.classId);
      if (!classInfo || classInfo.teacherId !== teacherId) {
        return res.status(403).json({ message: "Not authorized for this student" });
      }
      
      // Use transactional method to update balance and log transaction atomically
      try {
        const result = await storage.takeCurrencyWithTransaction(
          submissionId,
          amount,
          teacherId,
          reason || 'Teacher adjustment'
        );
        
        res.json({ 
          success: true, 
          newBalance: result.newBalance,
          message: `Took ${result.actualAmount} coins from ${submission.studentName}` 
        });
      } catch (error: any) {
        if (error.message === "Student has no coins to take") {
          return res.status(400).json({ message: error.message });
        }
        throw error;
      }
    } catch (error) {
      console.error("Take currency error:", error);
      res.status(500).json({ message: "Failed to take currency" });
    }
  });
  

  
  // Get currency transactions for a class
  app.get("/api/currency/transactions/:classId", requireAuth, async (req: any, res) => {
    try {
      const teacherId = req.user.userId;
      const classId = safeParseInt(req.params.classId, 'classId');
      
      // Verify teacher owns the class
      const classInfo = await storage.getClassById(classId);
      if (!classInfo || classInfo.teacherId !== teacherId) {
        return res.status(403).json({ message: "Not authorized for this class" });
      }
      
      // Get transactions for this class
      const transactions = await storage.getCurrencyTransactionsByClass(classId);
      
      res.json(transactions);
    } catch (error: any) {
      if (error.message?.includes('Invalid')) {
        res.status(400).json({ message: error.message });
      } else {
        console.error("Get transactions error:", error);
        res.status(500).json({ message: "Failed to get transactions" });
      }
    }
  });

  // Get transaction history for a specific student
  app.get("/api/currency/history/:studentId", requireAuth, async (req: any, res) => {
    try {
      const teacherId = req.user.userId;
      const studentId = safeParseInt(req.params.studentId, 'studentId');
      
      // Get the student submission and verify teacher owns the class
      const submission = await storage.getSubmissionById(studentId);
      if (!submission) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      const classInfo = await storage.getClassById(submission.classId);
      if (!classInfo || classInfo.teacherId !== teacherId) {
        return res.status(403).json({ message: "Not authorized for this student" });
      }
      
      // Get transaction history for this student
      const transactions = await storage.getCurrencyTransactionsByStudent(studentId);
      
      res.json(transactions);
    } catch (error: any) {
      if (error.message?.includes('Invalid')) {
        res.status(400).json({ message: error.message });
      } else {
        console.error("Get transaction history error:", error);
        res.status(500).json({ message: "Failed to get transaction history" });
      }
    }
  });

  // Register island routes (currency system)
  registerIslandRoutes(app);
  
  // Register purchase approval routes (teacher auth required)
  registerPurchaseApprovalRoutes(app);
  
  // Register store management routes (teacher auth required)
  registerStoreManagementRoutes(app);
  
  // Register item position routes (admin auth required)
  registerItemPositionRoutes(app);

  // Register store admin routes
  registerStoreAdminRoutes(app);
  
  // Register asset management routes (admin only)
  app.use('/api/admin/assets', assetsRouter);
  
  // Register new store routes (simple version)
  app.use('/api/store', storeRouter);
  
  // Debug route for testing
  app.use('/api/debug/store', debugStoreRouter);
  
  // Comment out or remove the old store routes:
  // app.use('/api/store', storeRoutes);
  
  // Register admin upload routes
  app.use('/api/admin', adminUploadRoutes);
  
  // Register monitoring routes
  app.use('/api/admin', monitoringRoutes);
  
  // Register quick stats routes
  app.use('/api/admin', quickStatsRoutes);

  const httpServer = createServer(app);
  
  // Conditionally initialize WebSocket server based on feature flag
  if (FEATURE_FLAGS.WEBSOCKET_ENABLED && FEATURE_FLAGS.GAMES_ENABLED) {
    const gameWebSocketServer = new GameWebSocketServer(httpServer);
    
    // Store reference for cleanup
    (app as any).gameWebSocketServer = gameWebSocketServer;
    
    console.log('✅ WebSocket server enabled for games');
  } else {
    console.log('⏸️  WebSocket server disabled (GAMES_ENABLED=false)');
  }
  
  return httpServer;
}
