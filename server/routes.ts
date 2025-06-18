import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertClassSchema, insertQuizSubmissionSchema, updateUserProfileSchema, updatePasswordSchema, insertLessonProgressSchema } from "@shared/schema";
import jwt from "jsonwebtoken";
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
import { requireAuth } from "./middleware/auth";

// Feature flags to disable unused features
const FEATURE_FLAGS = {
  GAMES_ENABLED: process.env.GAMES_ENABLED !== 'false', // Default true for backward compatibility
  WEBSOCKET_ENABLED: process.env.WEBSOCKET_ENABLED !== 'false',
  METRICS_ENABLED: process.env.METRICS_ENABLED !== 'false',
};

// Require JWT secret to be set
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable must be set");
}

// Type assertion to ensure JWT_SECRET is string
const jwtSecret = JWT_SECRET as string;

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

// Middleware to verify admin access
async function authenticateAdmin(req: any, res: any, next: any) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }
  
  jwt.verify(token, jwtSecret, async (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }
    
    try {
      const user = await storage.getUserById(decoded.userId);
      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      req.user = decoded;
      req.adminUser = user;
      next();
    } catch (error) {
      return res.status(403).json({ message: "Admin verification failed" });
    }
  });
}

export async function registerRoutes(app: Express): Promise<Server> {

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", websocket: "ready" });
  });

  // Register student island routes (no auth required)
  registerIslandRoutes(app);
  
  // Register secure student island routes (session-based auth)
  registerSecureIslandRoutes(app);

  // Teacher registration
  app.post("/api/register", authLimiter, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }
      
      const user = await storage.createUser(userData);
      const token = jwt.sign(
        { userId: user.id, email: user.email }, 
        jwtSecret,
        { expiresIn: process.env.SESSION_TIMEOUT || '24h' } as jwt.SignOptions
      );
      
      const refreshToken = jwt.sign(
        { userId: user.id, email: user.email, type: 'refresh' },
        jwtSecret,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d' } as jwt.SignOptions
      );
      
      res.json({ 
        token,
        refreshToken,
        user: { 
          id: user.id, 
          firstName: user.firstName, 
          lastName: user.lastName, 
          email: user.email,
          personalityAnimal: user.personalityAnimal,
          isAdmin: user.isAdmin
        }
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ message: "Invalid registration data" });
    }
  });


  // Teacher login
  app.post("/api/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password required" });
      }
      
      const user = await storage.validateUserPassword(email, password);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      const token = jwt.sign(
        { userId: user.id, email: user.email }, 
        jwtSecret,
        { expiresIn: process.env.SESSION_TIMEOUT || '24h' } as jwt.SignOptions
      );
      
      const refreshToken = jwt.sign(
        { userId: user.id, email: user.email, type: 'refresh' },
        jwtSecret,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d' } as jwt.SignOptions
      );
      
      res.json({ 
        token,
        refreshToken,
        user: { 
          id: user.id, 
          firstName: user.firstName, 
          lastName: user.lastName, 
          email: user.email,
          personalityAnimal: user.personalityAnimal,
          isAdmin: user.isAdmin
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Refresh token endpoint
  app.post("/api/refresh-token", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token required" });
      }
      
      const decoded = jwt.verify(refreshToken, jwtSecret) as any;
      
      if (decoded.type !== 'refresh') {
        return res.status(401).json({ message: "Invalid token type" });
      }
      
      const user = await storage.getUserById(decoded.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const newToken = jwt.sign(
        { userId: user.id, email: user.email },
        jwtSecret,
        { expiresIn: process.env.SESSION_TIMEOUT || '24h' } as jwt.SignOptions
      );
      
      const newRefreshToken = jwt.sign(
        { userId: user.id, email: user.email, type: 'refresh' },
        jwtSecret,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d' } as jwt.SignOptions
      );
      
      res.json({ token: newToken, refreshToken: newRefreshToken });
    } catch (error) {
      console.error("Token refresh error:", error);
      res.status(401).json({ message: "Invalid refresh token" });
    }
  });

  // Get current user
  app.get("/api/me", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ 
        id: user.id, 
        firstName: user.firstName, 
        lastName: user.lastName, 
        email: user.email,
        schoolOrganization: user.schoolOrganization,
        roleTitle: user.roleTitle,
        howHeardAbout: user.howHeardAbout,
        personalityAnimal: user.personalityAnimal,
        isAdmin: user.isAdmin
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Update user profile
  app.put("/api/me/profile", requireAuth, async (req: any, res) => {
    try {
      let profileData = updateUserProfileSchema.parse(req.body);
      
      // Handle "not-selected" as null for personalityAnimal
      if (profileData.personalityAnimal === "not-selected") {
        profileData = { ...profileData, personalityAnimal: null };
      }
      
      // Check if email is being changed and if it's already taken
      if (profileData.email && profileData.email !== req.user.email) {
        const existingUser = await storage.getUserByEmail(profileData.email);
        if (existingUser && existingUser.id !== req.user.userId) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }
      
      const updatedUser = await storage.updateUserProfile(req.user.userId, profileData);
      
      res.json({
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        schoolOrganization: updatedUser.schoolOrganization,
        roleTitle: updatedUser.roleTitle,
        howHeardAbout: updatedUser.howHeardAbout
      });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(400).json({ message: "Failed to update profile" });
    }
  });

  // Update user password
  app.put("/api/me/password", requireAuth, async (req: any, res) => {
    try {
      const passwordData = updatePasswordSchema.parse(req.body);
      
      const success = await storage.updateUserPassword(
        req.user.userId,
        passwordData.currentPassword,
        passwordData.newPassword
      );
      
      if (!success) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Update password error:", error);
      res.status(400).json({ message: "Failed to update password" });
    }
  });

  // Create class
  app.post("/api/classes", requireAuth, async (req: any, res) => {
    try {
      const classData = insertClassSchema.parse({
        ...req.body,
        teacherId: req.user.userId,
      });
      
      const newClass = await storage.createClass(classData);
      res.json(newClass);
    } catch (error) {
      console.error("Create class error:", error);
      res.status(400).json({ message: "Failed to create class" });
    }
  });

  // Get teacher's classes
  app.get("/api/classes", requireAuth, async (req: any, res) => {
    try {
      const classes = await storage.getClassesByTeacherId(req.user.userId);
      
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
      console.error("Get classes error:", error);
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

  // Submit quiz
  app.post("/api/quiz/submit", async (req, res) => {
    try {
      const submission = insertQuizSubmissionSchema.parse(req.body);
      const result = await storage.createQuizSubmission(submission);
      res.json(result);
    } catch (error) {
      console.error("Submit quiz error:", error);
      res.status(400).json({ message: "Failed to submit quiz" });
    }
  });

  // Submit quiz submissions (alternative endpoint)
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
      const result = await storage.createQuizSubmission(submission);
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
  
  // Toggle store status for a class
  app.post("/api/currency/store/toggle", requireAuth, async (req: any, res) => {
    try {
      const teacherId = req.user.userId;
      const { classId, isOpen } = req.body;
      
      // Verify teacher owns the class
      const classInfo = await storage.getClassById(classId);
      if (!classInfo || classInfo.teacherId !== teacherId) {
        return res.status(403).json({ message: "Not authorized for this class" });
      }
      
      // Toggle store status
      await storage.updateStoreStatus(classId, isOpen);
      
      res.json({ 
        success: true, 
        isOpen,
        message: `Store ${isOpen ? 'opened' : 'closed'} for ${classInfo.name}` 
      });
    } catch (error) {
      console.error("Toggle store error:", error);
      res.status(500).json({ message: "Failed to toggle store status" });
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
