// Room Visit Tracking API - For achievement system and analytics
import { z } from "zod";
import type { Express } from "express";
import { db } from "../db.js";
import { roomVisits, students, classes } from "@shared/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { optionalStudentAuth } from "../middleware/passport-auth.js";
import { roomBrowsingLimiter } from "../middleware/rateLimiter.js";

// Validation schemas
const recordVisitSchema = z.object({
  visitedPassportCode: z.string().regex(/^[A-Z]{3}-[A-Z0-9]{3}$/, "Invalid passport code format"),
});

const getVisitStatsSchema = z.object({
  passportCode: z.string().regex(/^[A-Z]{3}-[A-Z0-9]{3}$/, "Invalid passport code format"),
});

export function registerRoomVisitRoutes(app: Express) {
  
  // POST /api/room-visits/record - Record a room visit
  app.post("/api/room-visits/record", optionalStudentAuth, roomBrowsingLimiter, async (_req, res) => {
    try {
      const { visitedPassportCode } = recordVisitSchema.parse(req.body);
      
      // Get visitor student info from authenticated session
      if (!req.student?.id) {
        return res.status(401).json({ 
          error: "Authentication required", 
          message: "You must be logged in to record room visits" 
        });
      }

      const visitorStudentId = req.student.id;
      
      // Get visited student info
      const visitedStudentData = await db
        .select({
          id: students.id,
          studentName: students.studentName,
          classId: students.classId,
        })
        .from(students)
        .where(eq(students.passportCode, visitedPassportCode))
        .limit(1);

      if (visitedStudentData.length === 0) {
        return res.status(404).json({ 
          error: "Student not found", 
          message: "No student found with that passport code" 
        });
      }

      const visitedStudent = visitedStudentData[0];

      // Prevent self-visits (should be caught by DB constraint too)
      if (visitorStudentId === visitedStudent.id) {
        return res.status(400).json({ 
          error: "Invalid visit", 
          message: "You cannot visit your own room" 
        });
      }

      // Check if visit record already exists
      const existingVisit = await db
        .select()
        .from(roomVisits)
        .where(and(
          eq(roomVisits.visitorStudentId, visitorStudentId),
          eq(roomVisits.visitedStudentId, visitedStudent.id)
        ))
        .limit(1);

      if (existingVisit.length > 0) {
        // Update existing visit record
        const updatedVisit = await db
          .update(roomVisits)
          .set({
            lastVisitAt: new Date(),
            visitCount: existingVisit[0].visitCount + 1,
            updatedAt: new Date(),
          })
          .where(and(
            eq(roomVisits.visitorStudentId, visitorStudentId),
            eq(roomVisits.visitedStudentId, visitedStudent.id)
          ))
          .returning();

        return res.json({
          success: true,
          message: `Visit to ${visitedStudent.studentName}'s room recorded`,
          visit: updatedVisit[0],
          isNewVisit: false,
        });
      } else {
        // Create new visit record
        const newVisit = await db
          .insert(roomVisits)
          .values({
            visitorStudentId,
            visitedStudentId: visitedStudent.id,
            visitCount: 1,
          })
          .returning();

        return res.json({
          success: true,
          message: `First visit to ${visitedStudent.studentName}'s room recorded`,
          visit: newVisit[0],
          isNewVisit: true,
        });
      }

    } catch (error: any) {
      console.error("Record visit error:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          error: "Invalid input", 
          message: "Please check your request data",
          details: error.errors 
        });
      }

      // Handle database constraint violations
      if (error.message?.includes('chk_no_self_visits')) {
        return res.status(400).json({ 
          error: "Invalid visit", 
          message: "You cannot visit your own room" 
        });
      }

      res.status(500).json({ 
        error: "Internal server error", 
        message: "Failed to record room visit" 
      });
    }
  });

  // GET /api/room-visits/my-visits - Get visits made by the authenticated student
  app.get("/api/room-visits/my-visits", optionalStudentAuth, roomBrowsingLimiter, async (_req, res) => {
    try {
      if (!req.student?.id) {
        return res.status(401).json({ 
          error: "Authentication required", 
          message: "You must be logged in to view your visits" 
        });
      }

      const visits = await db
        .select({
          id: roomVisits.id,
          visitedStudentId: roomVisits.visitedStudentId,
          visitedStudentName: students.studentName,
          visitedStudentPassportCode: students.passportCode,
          firstVisitAt: roomVisits.firstVisitAt,
          lastVisitAt: roomVisits.lastVisitAt,
          visitCount: roomVisits.visitCount,
        })
        .from(roomVisits)
        .innerJoin(students, eq(roomVisits.visitedStudentId, students.id))
        .where(eq(roomVisits.visitorStudentId, req.student.id))
        .orderBy(desc(roomVisits.lastVisitAt));

      // Get unique visit count for Social Butterfly achievement
      const uniqueVisitsCount = visits.length;

      return res.json({
        success: true,
        visits,
        uniqueVisitsCount,
        message: `You have visited ${uniqueVisitsCount} unique classmate rooms`,
      });

    } catch (error: any) {
      console.error("Get my visits error:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: "Failed to fetch your room visits" 
      });
    }
  });

  // GET /api/room-visits/visitors/:passportCode - Get visitors to a student's room
  app.get("/api/room-visits/visitors/:passportCode", optionalStudentAuth, roomBrowsingLimiter, async (_req, res) => {
    try {
      const { passportCode } = getVisitStatsSchema.parse({ passportCode: req.params.passportCode });

      // Get room owner student info
      const roomOwnerData = await db
        .select({
          id: students.id,
          studentName: students.studentName,
          classId: students.classId,
        })
        .from(students)
        .where(eq(students.passportCode, passportCode))
        .limit(1);

      if (roomOwnerData.length === 0) {
        return res.status(404).json({ 
          error: "Student not found", 
          message: "No student found with that passport code" 
        });
      }

      const roomOwner = roomOwnerData[0];

      // Get all visitors to this room
      const visitors = await db
        .select({
          id: roomVisits.id,
          visitorStudentId: roomVisits.visitorStudentId,
          visitorStudentName: students.studentName,
          visitorStudentPassportCode: students.passportCode,
          firstVisitAt: roomVisits.firstVisitAt,
          lastVisitAt: roomVisits.lastVisitAt,
          visitCount: roomVisits.visitCount,
        })
        .from(roomVisits)
        .innerJoin(students, eq(roomVisits.visitorStudentId, students.id))
        .where(eq(roomVisits.visitedStudentId, roomOwner.id))
        .orderBy(desc(roomVisits.lastVisitAt));

      // Calculate stats
      const uniqueVisitorsCount = visitors.length;
      const totalVisitsCount = visitors.reduce((sum, visit) => sum + visit.visitCount, 0);

      return res.json({
        success: true,
        roomOwner: {
          studentName: roomOwner.studentName,
          passportCode: passportCode,
        },
        visitors,
        stats: {
          uniqueVisitorsCount,
          totalVisitsCount,
        },
        message: `${roomOwner.studentName}'s room has been visited by ${uniqueVisitorsCount} unique students`,
      });

    } catch (error: any) {
      console.error("Get visitors error:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          error: "Invalid input", 
          message: "Invalid passport code format" 
        });
      }

      res.status(500).json({ 
        error: "Internal server error", 
        message: "Failed to fetch room visitors" 
      });
    }
  });

  // GET /api/room-visits/class-stats/:classId - Get class-wide visit statistics (for teachers)
  app.get("/api/room-visits/class-stats/:classId", optionalStudentAuth, roomBrowsingLimiter, async (_req, res) => {
    try {
      const classId = req.params.classId;

      // Get all students in the class
      const classStudents = await db
        .select({
          id: students.id,
          studentName: students.studentName,
          passportCode: students.passportCode,
        })
        .from(students)
        .where(eq(students.classId, classId));

      if (classStudents.length === 0) {
        return res.status(404).json({ 
          error: "Class not found", 
          message: "No students found in this class" 
        });
      }

      const studentIds = classStudents.map(s => s.id);

      // Get visit counts per student (as visitors)
      const visitStats = await db
        .select({
          visitorStudentId: roomVisits.visitorStudentId,
          uniqueRoomsVisited: count(roomVisits.visitedStudentId),
        })
        .from(roomVisits)
        .where(eq(roomVisits.visitorStudentId, studentIds[0])) // This is a placeholder, we'll aggregate properly
        .groupBy(roomVisits.visitorStudentId);

      // TODO: Implement proper class-wide statistics
      // For now, return basic structure
      return res.json({
        success: true,
        classStats: {
          totalStudents: classStudents.length,
          studentsWithVisits: 0, // Will implement proper counting
          averageVisitsPerStudent: 0,
        },
        message: "Class visit statistics retrieved",
      });

    } catch (error: any) {
      console.error("Get class stats error:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: "Failed to fetch class visit statistics" 
      });
    }
  });
}

export default registerRoomVisitRoutes;