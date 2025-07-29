// Student Achievement System API - For tracking and unlocking achievements
import { z } from "zod";
import type { Express } from "express";
import { db } from "../db.js";
import { studentAchievements, students, roomVisits, roomGuestbook } from "@shared/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { optionalStudentAuth } from "../middleware/passport-auth.js";
import { roomBrowsingLimiter } from "../middleware/rateLimiter.js";

// Achievement definitions
export const ACHIEVEMENTS = {
  FIRST_LOGIN: {
    id: "first_login",
    name: "First Login",
    description: "Welcome to Animal Genius! You've taken your first step.",
    icon: "🎯",
    type: "instant" as const,
  },
  QUIZ_CHAMPION: {
    id: "quiz_champion", 
    name: "Quiz Champion",
    description: "Completed the Animal Genius personality quiz.",
    icon: "🌟",
    type: "instant" as const,
  },
  ROOM_DECORATOR: {
    id: "room_decorator",
    name: "Room Decorator", 
    description: "Customized your room with decorations and items.",
    icon: "💎",
    type: "instant" as const,
  },
  SOCIAL_BUTTERFLY: {
    id: "social_butterfly",
    name: "Social Butterfly",
    description: "Visited 5 unique classmate rooms.",
    icon: "🏅", 
    type: "progress" as const,
    target: 5,
  },
} as const;

type AchievementId = keyof typeof ACHIEVEMENTS;

// Validation schemas
const unlockAchievementSchema = z.object({
  achievementId: z.enum(["first_login", "quiz_champion", "room_decorator", "social_butterfly"]),
  progressData: z.object({}).optional(), // For future extensibility
});

export function registerStudentAchievementRoutes(app: Express) {
  
  // GET /api/student-achievements/my-achievements - Get all achievements for authenticated student
  app.get("/api/student-achievements/my-achievements", optionalStudentAuth, roomBrowsingLimiter, async (_req, res) => {
    try {
      if (!req.student?.id) {
        return res.status(401).json({ 
          error: "Authentication required", 
          message: "You must be logged in to view your achievements" 
        });
      }

      const studentId = req.student.id;

      // Get unlocked achievements from database
      const unlockedAchievements = await db
        .select({
          id: studentAchievements.id,
          achievementCode: studentAchievements.achievementCode,
          earnedAt: studentAchievements.earnedAt,
          progressData: studentAchievements.progressData,
        })
        .from(studentAchievements)
        .where(eq(studentAchievements.studentId, studentId))
        .orderBy(desc(studentAchievements.earnedAt));

      // Calculate current progress for progress-based achievements
      const progressData = await calculateAchievementProgress(studentId);

      // Combine achievement definitions with unlock status and progress
      const achievementsWithStatus = Object.entries(ACHIEVEMENTS).map(([key, achievement]) => {
        const achievementId = key.toLowerCase();
        const unlocked = unlockedAchievements.find(ua => ua.achievementCode === achievementId);
        const progress = progressData[achievementId] || {};

        return {
          ...achievement,
          id: achievementId,
          unlocked: !!unlocked,
          earnedAt: unlocked?.earnedAt || null,
          progress: achievement.type === "progress" ? {
            current: progress.current || 0,
            target: achievement.target || 1,
            percentage: Math.min(100, Math.round(((progress.current || 0) / (achievement.target || 1)) * 100)),
          } : null,
        };
      });

      return res.json({
        success: true,
        achievements: achievementsWithStatus,
        stats: {
          totalAchievements: Object.keys(ACHIEVEMENTS).length,
          unlockedCount: unlockedAchievements.length,
          completionPercentage: Math.round((unlockedAchievements.length / Object.keys(ACHIEVEMENTS).length) * 100),
        },
        message: `You have unlocked ${unlockedAchievements.length} of ${Object.keys(ACHIEVEMENTS).length} achievements`,
      });

    } catch (error: any) {
      console.error("Get achievements error:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: "Failed to fetch your achievements" 
      });
    }
  });

  // POST /api/student-achievements/unlock - Unlock an achievement for the authenticated student
  app.post("/api/student-achievements/unlock", optionalStudentAuth, roomBrowsingLimiter, async (_req, res) => {
    try {
      const { achievementId, progressData } = unlockAchievementSchema.parse(req.body);
      
      if (!req.student?.id) {
        return res.status(401).json({ 
          error: "Authentication required", 
          message: "You must be logged in to unlock achievements" 
        });
      }

      const studentId = req.student.id;
      const achievement = ACHIEVEMENTS[achievementId.toUpperCase() as AchievementId];

      if (!achievement) {
        return res.status(400).json({ 
          error: "Invalid achievement", 
          message: "Achievement not found" 
        });
      }

      // Check if achievement is already unlocked
      const existingAchievement = await db
        .select()
        .from(studentAchievements)
        .where(and(
          eq(studentAchievements.studentId, studentId),
          eq(studentAchievements.achievementCode, achievementId)
        ))
        .limit(1);

      if (existingAchievement.length > 0) {
        return res.status(400).json({ 
          error: "Already unlocked", 
          message: "You have already unlocked this achievement" 
        });
      }

      // For progress-based achievements, verify they meet the requirements
      if (achievement.type === "progress") {
        const currentProgress = await calculateAchievementProgress(studentId);
        const achProgress = currentProgress[achievementId] || { current: 0 };

        if (achProgress.current < (achievement.target || 1)) {
          return res.status(400).json({ 
            error: "Requirements not met", 
            message: `You need ${achievement.target} but only have ${achProgress.current}`,
            progress: achProgress,
          });
        }
      }

      // Unlock the achievement
      const newAchievement = await db
        .insert(studentAchievements)
        .values({
          studentId,
          achievementCode: achievementId,
          achievementName: achievement.name,
          progressData: progressData || {},
        })
        .returning();

      return res.json({
        success: true,
        message: `Achievement unlocked: ${achievement.name}!`,
        achievement: {
          ...achievement,
          id: achievementId,
          unlocked: true,
          earnedAt: newAchievement[0].earnedAt,
        },
        celebration: {
          title: `🎉 ${achievement.name}`,
          description: achievement.description,
          icon: achievement.icon,
        },
      });

    } catch (error: any) {
      console.error("Unlock achievement error:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          error: "Invalid input", 
          message: "Please check your achievement data",
          details: error.errors 
        });
      }

      // Handle database constraint violations
      if (error.message?.includes('unique') || error.code === '23505') {
        return res.status(400).json({ 
          error: "Already unlocked", 
          message: "You have already unlocked this achievement" 
        });
      }

      res.status(500).json({ 
        error: "Internal server error", 
        message: "Failed to unlock achievement" 
      });
    }
  });

  // GET /api/student-achievements/check-progress - Check progress for all achievements
  app.get("/api/student-achievements/check-progress", optionalStudentAuth, roomBrowsingLimiter, async (_req, res) => {
    try {
      if (!req.student?.id) {
        return res.status(401).json({ 
          error: "Authentication required", 
          message: "You must be logged in to check achievement progress" 
        });
      }

      const studentId = req.student.id;
      const progressData = await calculateAchievementProgress(studentId);

      // Check which achievements can be auto-unlocked
      const autoUnlockable = [];
      for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
        const achievementId = key.toLowerCase();
        if (achievement.type === "progress") {
          const progress = progressData[achievementId] || { current: 0 };
          if (progress.current >= (achievement.target || 1)) {
            // Check if not already unlocked
            const existing = await db
              .select()
              .from(studentAchievements)
              .where(and(
                eq(studentAchievements.studentId, studentId),
                eq(studentAchievements.achievementCode, achievementId)
              ))
              .limit(1);

            if (existing.length === 0) {
              autoUnlockable.push({
                achievementId,
                achievement,
                progress: progress.current,
                target: achievement.target,
              });
            }
          }
        }
      }

      return res.json({
        success: true,
        progressData,
        autoUnlockable,
        message: autoUnlockable.length > 0 
          ? `${autoUnlockable.length} achievements ready to unlock!`
          : "No new achievements ready",
      });

    } catch (error: any) {
      console.error("Check progress error:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: "Failed to check achievement progress" 
      });
    }
  });

  // GET /api/student-achievements/definitions - Get all achievement definitions
  app.get("/api/student-achievements/definitions", async (_req, res) => {
    try {
      const achievementList = Object.entries(ACHIEVEMENTS).map(([key, achievement]) => ({
        ...achievement,
        id: key.toLowerCase(),
      }));

      return res.json({
        success: true,
        achievements: achievementList,
        message: "Achievement definitions retrieved",
      });

    } catch (error: any) {
      console.error("Get definitions error:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: "Failed to fetch achievement definitions" 
      });
    }
  });
}

// Helper function to calculate current progress for all achievements
async function calculateAchievementProgress(studentId: string): Promise<Record<string, any>> {
  try {
    // Social Butterfly: Visit 5 unique classmate rooms
    const uniqueVisitsResult = await db
      .select({
        count: count(roomVisits.visitedStudentId),
      })
      .from(roomVisits)
      .where(eq(roomVisits.visitorStudentId, studentId));

    // The count() function returns a string, so we need to convert it to a number
    const uniqueVisits = Number(uniqueVisitsResult[0]?.count) || 0;

    // Future achievements can be calculated here
    // Room Decorator: Could check for room customizations
    // Quiz Champion: Could check for quiz completion
    // First Login: Instant achievement

    return {
      social_butterfly: {
        current: uniqueVisits,
        target: ACHIEVEMENTS.SOCIAL_BUTTERFLY.target,
        description: "Unique rooms visited",
      },
      // Add other progress calculations here as needed
    };
  } catch (error: any) {
    console.error("Calculate achievement progress error:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      table: error.table,
      column: error.column
    });
    // Return empty progress instead of throwing to allow the endpoint to continue
    return {};
  }
}

export default registerStudentAchievementRoutes;