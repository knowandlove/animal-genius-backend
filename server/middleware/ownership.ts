import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { classes, students } from '@shared/schema';
import { and, eq } from 'drizzle-orm';

/**
 * Middleware to verify that the authenticated teacher owns the specified class.
 * The class ID can be provided in:
 * - req.params.classId
 * - req.params.id (when the route parameter is just 'id')
 * - req.body.classId
 * 
 * This middleware must be used after requireAuth middleware.
 */
export const verifyClassOwnership = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get class ID from various sources
    const classId = req.params.classId || req.params.id || req.body.classId;
    const teacherId = req.user?.userId || req.user?.id;

    if (!classId) {
      return res.status(400).json({ 
        message: "Class ID is required" 
      });
    }

    if (!teacherId) {
      return res.status(401).json({ 
        message: "Authentication required" 
      });
    }

    // Check if the teacher owns this class
    const [classData] = await db
      .select({ id: classes.id })
      .from(classes)
      .where(and(
        eq(classes.id, classId), 
        eq(classes.teacherId, teacherId)
      ))
      .limit(1);

    if (!classData) {
      return res.status(403).json({ 
        message: "Access denied: You do not have permission to access this class" 
      });
    }

    // Class ownership verified, proceed to the route handler
    next();
  } catch (error) {
    console.error("Class ownership verification failed:", error);
    res.status(500).json({ 
      message: "Internal server error" 
    });
  }
};

/**
 * Middleware to verify that the authenticated teacher owns the student's class.
 * The student ID must be provided in req.params.studentId or req.body.studentId
 * 
 * This middleware must be used after requireAuth middleware.
 */
export const verifyStudentClassOwnership = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId || req.body.studentId;
    const teacherId = req.user?.userId || req.user?.id;

    if (!studentId) {
      return res.status(400).json({ 
        message: "Student ID is required" 
      });
    }

    if (!teacherId) {
      return res.status(401).json({ 
        message: "Authentication required" 
      });
    }

    // Get the student and verify teacher owns the class
    const [student] = await db
      .select({ classId: students.classId })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    if (!student) {
      return res.status(404).json({ 
        message: "Student not found" 
      });
    }

    // Now verify the teacher owns this class
    const [classData] = await db
      .select({ id: classes.id })
      .from(classes)
      .where(and(
        eq(classes.id, student.classId), 
        eq(classes.teacherId, teacherId)
      ))
      .limit(1);

    if (!classData) {
      return res.status(403).json({ 
        message: "Access denied: You do not have permission to access this student" 
      });
    }

    // Store the class ID for use in the route handler if needed
    (req as any).studentClassId = student.classId;

    next();
  } catch (error) {
    console.error("Student class ownership verification failed:", error);
    res.status(500).json({ 
      message: "Internal server error" 
    });
  }
};