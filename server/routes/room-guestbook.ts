// Room Guestbook API - For visitor messages and social features
import type { Express } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { roomGuestbook, students, roomVisits } from "@shared/schema";
import { eq, and, desc, count, isNotNull } from "drizzle-orm";
import { optionalStudentAuth } from "../middleware/passport-auth.js";
import { roomBrowsingLimiter } from "../middleware/rateLimiter.js";

// Validation schemas
const createMessageSchema = z.object({
  roomOwnerPassportCode: z.string().regex(/^[A-Z]{3}-[A-Z0-9]{3}$/, "Invalid passport code format"),
  message: z.string().min(1, "Message cannot be empty").max(500, "Message too long (max 500 characters)"),
});

const getGuestbookSchema = z.object({
  passportCode: z.string().regex(/^[A-Z]{3}-[A-Z0-9]{3}$/, "Invalid passport code format"),
});

export function registerRoomGuestbookRoutes(app: Express) {
  
  // POST /api/room-guestbook/message - Create a guestbook message
  app.post("/api/room-guestbook/message", optionalStudentAuth, roomBrowsingLimiter, async (_req, res) => {
    try {
      const { roomOwnerPassportCode, message } = createMessageSchema.parse(req.body);
      
      // Get visitor student info from authenticated session
      if (!req.student?.id) {
        return res.status(401).json({ 
          error: "Authentication required", 
          message: "You must be logged in to leave messages" 
        });
      }

      const visitorStudentId = req.student.id;
      
      // Get room owner student info
      const roomOwnerData = await db
        .select({
          id: students.id,
          studentName: students.studentName,
          classId: students.classId,
        })
        .from(students)
        .where(eq(students.passportCode, roomOwnerPassportCode))
        .limit(1);

      if (roomOwnerData.length === 0) {
        return res.status(404).json({ 
          error: "Student not found", 
          message: "No student found with that passport code" 
        });
      }

      const roomOwner = roomOwnerData[0];

      // Prevent self-messages (should be caught by DB constraint too)
      if (visitorStudentId === roomOwner.id) {
        return res.status(400).json({ 
          error: "Invalid action", 
          message: "You cannot leave a message in your own room" 
        });
      }

      // Check if visitor has actually visited this room
      const hasVisited = await db
        .select()
        .from(roomVisits)
        .where(and(
          eq(roomVisits.visitorStudentId, visitorStudentId),
          eq(roomVisits.visitedStudentId, roomOwner.id)
        ))
        .limit(1);

      if (hasVisited.length === 0) {
        return res.status(400).json({ 
          error: "Visit required", 
          message: "You must visit this room before leaving a message" 
        });
      }

      // Create the guestbook message
      const newMessage = await db
        .insert(roomGuestbook)
        .values({
          roomOwnerStudentId: roomOwner.id,
          visitorStudentId,
          message: message.trim(),
          visitorName: req.student.studentName,
          visitorAnimalType: undefined, // TODO: Get from database if needed
        })
        .returning();

      // Get visitor name for response
      const visitorName = req.student.studentName;

      return res.json({
        success: true,
        message: `Message from ${visitorName} posted to ${roomOwner.studentName}'s guestbook`,
        guestbookEntry: {
          ...newMessage[0],
          visitorName,
          roomOwnerName: roomOwner.studentName,
        },
      });

    } catch (error: any) {
      console.error("Create guestbook message error:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          error: "Invalid input", 
          message: "Please check your message data",
          details: error.errors 
        });
      }

      // Handle database constraint violations
      if (error.message?.includes('chk_no_self_messages')) {
        return res.status(400).json({ 
          error: "Invalid action", 
          message: "You cannot leave a message in your own room" 
        });
      }

      res.status(500).json({ 
        error: "Internal server error", 
        message: "Failed to create guestbook message" 
      });
    }
  });

  // GET /api/room-guestbook/my-messages - Get messages written by the authenticated student
  app.get("/api/room-guestbook/my-messages", optionalStudentAuth, roomBrowsingLimiter, async (_req, res) => {
    try {
      if (!req.student?.id) {
        return res.status(401).json({ 
          error: "Authentication required", 
          message: "You must be logged in to view your messages" 
        });
      }

      // Get all messages written by this student
      const myMessages = await db
        .select({
          id: roomGuestbook.id,
          message: roomGuestbook.message,
          createdAt: roomGuestbook.createdAt,
          roomOwnerStudentId: roomGuestbook.roomOwnerStudentId,
          roomOwnerStudentName: students.studentName,
          roomOwnerStudentPassportCode: students.passportCode,
        })
        .from(roomGuestbook)
        .innerJoin(students, eq(roomGuestbook.roomOwnerStudentId, students.id))
        .where(eq(roomGuestbook.visitorStudentId, req.student.id))
        .orderBy(desc(roomGuestbook.createdAt));

      return res.json({
        success: true,
        myMessages,
        stats: {
          totalMessages: myMessages.length,
          roomsVisited: myMessages.length, // Each message represents a unique room visited
        },
        message: `You have written ${myMessages.length} guestbook messages`,
      });

    } catch (error: any) {
      console.error("Get my messages error:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: "Failed to fetch your guestbook messages" 
      });
    }
  });

  // GET /api/room-guestbook/:passportCode - Get guestbook messages for a room
  app.get("/api/room-guestbook/:passportCode", optionalStudentAuth, roomBrowsingLimiter, async (_req, res) => {
    try {
      const { passportCode } = getGuestbookSchema.parse({ passportCode: req.params.passportCode });

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

      // Get all guestbook messages for this room
      const guestbookMessages = await db
        .select({
          id: roomGuestbook.id,
          message: roomGuestbook.message,
          createdAt: roomGuestbook.createdAt,
          visitorStudentId: roomGuestbook.visitorStudentId,
          visitorStudentName: students.studentName,
          visitorStudentPassportCode: students.passportCode,
        })
        .from(roomGuestbook)
        .innerJoin(students, eq(roomGuestbook.visitorStudentId, students.id))
        .where(eq(roomGuestbook.roomOwnerStudentId, roomOwner.id))
        .orderBy(desc(roomGuestbook.createdAt));

      // Get unique visitor count for this room
      const uniqueVisitorCount = await db
        .select({
          count: count(roomVisits.visitorStudentId),
        })
        .from(roomVisits)
        .where(eq(roomVisits.visitedStudentId, roomOwner.id));

      return res.json({
        success: true,
        roomOwner: {
          studentName: roomOwner.studentName,
          passportCode: passportCode,
        },
        guestbookMessages,
        stats: {
          messageCount: guestbookMessages.length,
          uniqueVisitorCount: uniqueVisitorCount[0]?.count || 0,
        },
        message: `${roomOwner.studentName}'s guestbook with ${guestbookMessages.length} messages`,
      });

    } catch (error: any) {
      console.error("Get guestbook messages error:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          error: "Invalid input", 
          message: "Invalid passport code format" 
        });
      }

      res.status(500).json({ 
        error: "Internal server error", 
        message: "Failed to fetch guestbook messages" 
      });
    }
  });

  // DELETE /api/room-guestbook/message/:messageId - Delete a guestbook message (owner only)
  app.delete("/api/room-guestbook/message/:messageId", optionalStudentAuth, roomBrowsingLimiter, async (_req, res) => {
    try {
      const messageId = req.params.messageId;

      if (!req.student?.id) {
        return res.status(401).json({ 
          error: "Authentication required", 
          message: "You must be logged in to delete messages" 
        });
      }

      // Get the message details to check ownership
      const messageData = await db
        .select({
          id: roomGuestbook.id,
          roomOwnerStudentId: roomGuestbook.roomOwnerStudentId,
          visitorStudentId: roomGuestbook.visitorStudentId,
          message: roomGuestbook.message,
        })
        .from(roomGuestbook)
        .where(eq(roomGuestbook.id, messageId))
        .limit(1);

      if (messageData.length === 0) {
        return res.status(404).json({ 
          error: "Message not found", 
          message: "No guestbook message found with that ID" 
        });
      }

      const messageDetails = messageData[0];

      // Check if the authenticated student is the room owner (can delete any message) 
      // or the message author (can delete their own message)
      const canDelete = messageDetails.roomOwnerStudentId === req.student.id || 
                       messageDetails.visitorStudentId === req.student.id;

      if (!canDelete) {
        return res.status(403).json({ 
          error: "Permission denied", 
          message: "You can only delete messages in your own room or your own messages" 
        });
      }

      // Delete the message
      await db
        .delete(roomGuestbook)
        .where(eq(roomGuestbook.id, messageId));

      return res.json({
        success: true,
        message: "Guestbook message deleted successfully",
      });

    } catch (error: any) {
      console.error("Delete guestbook message error:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: "Failed to delete guestbook message" 
      });
    }
  });
}

export default registerRoomGuestbookRoutes;