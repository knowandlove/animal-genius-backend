import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { classes, students } from '@shared/schema';
import { and, eq } from 'drizzle-orm';
import { createSecureLogger } from '../utils/secure-logger';
import type { AuthenticatedRequest } from '../types/api';

const logger = createSecureLogger('Ownership');
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Simple middleware to verify class ownership.
 * 
 * The class ID can be provided in:
 * - req.params.classId
 * - req.params.id (when the route parameter is just 'id')
 * 
 * This middleware must be used after requireAuth middleware.
 */
export const verifyClassAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    // SECURITY: Only accept class ID from URL params to prevent IDOR attacks
    const classId = req.params.classId || req.params.id;
    const teacherId = authReq.user?.userId;

    if (!classId) {
      return res.status(400).json({ 
        message: "Class ID is required in URL parameters" 
      });
    }

    // Validate UUID format
    if (!UUID_REGEX.test(classId)) {
      logger.warn('Invalid class ID format attempted', { classId, teacherId });
      return res.status(400).json({ 
        message: "Invalid class ID format" 
      });
    }

    if (!teacherId) {
      return res.status(401).json({ 
        message: "Authentication required" 
      });
    }

    // Check if the teacher owns the class
    const [classData] = await db
      .select({ teacherId: classes.teacherId })
      .from(classes)
      .where(eq(classes.id, classId))
      .limit(1);

    if (!classData) {
      logger.warn('Class not found', { classId, teacherId });
      return res.status(404).json({ 
        message: "Class not found" 
      });
    }

    if (classData.teacherId !== teacherId) {
      logger.warn('Unauthorized class access attempt', { 
        classId, 
        teacherId, 
        ownerId: classData.teacherId 
      });
      return res.status(403).json({ 
        message: "You don't have access to this class" 
      });
    }

    next();
  } catch (error) {
    logger.error('Error checking class ownership', error);
    res.status(500).json({ 
      message: "Failed to verify class ownership" 
    });
  }
};

/**
 * Alias for verifyClassAccess since edit access is the same as ownership
 */
export const verifyClassEditAccess = verifyClassAccess;

/**
 * Middleware to verify student belongs to teacher's class
 */
export const verifyStudentClassAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const studentId = req.params.studentId || req.params.id || req.body.studentId;
    const teacherId = authReq.user?.userId;

    if (!studentId || !teacherId) {
      return res.status(400).json({ 
        message: "Student ID and authentication required" 
      });
    }

    // Get student with their class ownership info
    const [student] = await db
      .select({
        classId: students.classId,
        teacherId: classes.teacherId
      })
      .from(students)
      .leftJoin(classes, eq(students.classId, classes.id))
      .where(eq(students.id, studentId))
      .limit(1);

    if (!student) {
      logger.warn('Student not found', { studentId, teacherId });
      return res.status(404).json({ 
        message: "Student not found" 
      });
    }

    if (student.teacherId !== teacherId) {
      logger.warn('Unauthorized student access attempt', { 
        studentId, 
        teacherId, 
        classOwnerId: student.teacherId 
      });
      return res.status(403).json({ 
        message: "You don't have access to this student" 
      });
    }

    next();
  } catch (error) {
    logger.error('Error checking student access', error);
    res.status(500).json({ 
      message: "Failed to verify student access" 
    });
  }
};

/**
 * Alias for verifyStudentClassAccess since edit access is the same as ownership
 */
export const verifyStudentClassEditAccess = verifyStudentClassAccess;

/**
 * Middleware to verify class ownership for routes that require it
 */
export const requireClassOwner = verifyClassAccess;