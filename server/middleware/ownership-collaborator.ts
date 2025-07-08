import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { classes, students } from '@shared/schema';
import { and, eq } from 'drizzle-orm';
import { hasClassAccess, canEditClass, getClassRole } from '../db/collaborators';
import { CollaboratorRequest } from './collaborators';

/**
 * Enhanced middleware to verify class access including collaborator permissions.
 * Replaces verifyClassOwnership to support co-teachers.
 * 
 * The class ID can be provided in:
 * - req.params.classId
 * - req.params.id (when the route parameter is just 'id')
 * - req.body.classId
 * 
 * This middleware must be used after requireAuth middleware.
 */
export const verifyClassAccess = async (req: CollaboratorRequest, res: Response, next: NextFunction) => {
  try {
    // SECURITY: Only accept class ID from URL params to prevent IDOR attacks
    const classId = req.params.classId || req.params.id;
    const teacherId = req.user?.userId;

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

    // Check if the teacher has access (owner or collaborator)
    const hasAccess = await hasClassAccess(teacherId, classId);
    
    if (!hasAccess) {
      logger.warn('Class access verification failed', { 
        classId, 
        teacherId,
        endpoint: req.originalUrl 
      });
      return res.status(403).json({ 
        message: "Access denied: You do not have permission to access this class" 
      });
    }

    // Add role information to request
    req.userRole = await getClassRole(teacherId, classId);

    next();
  } catch (error) {
    logger.error("Class access verification failed:", error);
    res.status(500).json({ 
      message: "Internal server error" 
    });
  }
};

/**
 * Enhanced middleware to verify edit permissions for a class.
 * Checks if user is owner or has editor role.
 * 
 * This middleware must be used after requireAuth middleware.
 */
export const verifyClassEditAccess = async (req: CollaboratorRequest, res: Response, next: NextFunction) => {
  try {
    // SECURITY: Only accept class ID from URL params to prevent IDOR attacks
    const classId = req.params.classId || req.params.id;
    const teacherId = req.user?.userId;

    if (!classId) {
      return res.status(400).json({ 
        message: "Class ID is required in URL parameters" 
      });
    }

    // Validate UUID format
    if (!UUID_REGEX.test(classId)) {
      logger.warn('Invalid class ID format attempted for edit', { classId, teacherId });
      return res.status(400).json({ 
        message: "Invalid class ID format" 
      });
    }

    if (!teacherId) {
      return res.status(401).json({ 
        message: "Authentication required" 
      });
    }

    // Check if the teacher can edit (owner or editor)
    const canEdit = await canEditClass(teacherId, classId);
    
    if (!canEdit) {
      logger.warn('Class edit access verification failed', { 
        classId, 
        teacherId,
        endpoint: req.originalUrl 
      });
      return res.status(403).json({ 
        message: "Access denied: You do not have permission to edit this class" 
      });
    }

    // Add role information to request
    req.userRole = await getClassRole(teacherId, classId);
    req.hasEditAccess = true;

    next();
  } catch (error) {
    logger.error("Class edit access verification failed:", error);
    res.status(500).json({ 
      message: "Internal server error" 
    });
  }
};

/**
 * Enhanced middleware to verify student access including collaborator permissions.
 * The student ID must be provided in req.params.studentId or req.body.studentId
 * 
 * This middleware must be used after requireAuth middleware.
 */
export const verifyStudentClassAccess = async (req: CollaboratorRequest, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId || req.body.studentId;
    const teacherId = req.user?.userId;

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

    // Get the student and their class
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

    // Check if the teacher has access to this class
    const hasAccess = await hasClassAccess(teacherId, student.classId);
    
    if (!hasAccess) {
      return res.status(403).json({ 
        message: "Access denied: You do not have permission to access this student" 
      });
    }

    // Store the class ID and role for use in the route handler
    (req as any).studentClassId = student.classId;
    req.userRole = await getClassRole(teacherId, student.classId);

    next();
  } catch (error) {
    console.error("Student class access verification failed:", error);
    res.status(500).json({ 
      message: "Internal server error" 
    });
  }
};

/**
 * Enhanced middleware to verify student edit access.
 * Checks if user has edit permissions for the student's class.
 * 
 * This middleware must be used after requireAuth middleware.
 */
export const verifyStudentClassEditAccess = async (req: CollaboratorRequest, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId || req.body.studentId;
    const teacherId = req.user?.userId;

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

    // Get the student and their class
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

    // Check if the teacher can edit this class
    const canEdit = await canEditClass(teacherId, student.classId);
    
    if (!canEdit) {
      return res.status(403).json({ 
        message: "Access denied: You do not have permission to edit this student" 
      });
    }

    // Store the class ID and role for use in the route handler
    (req as any).studentClassId = student.classId;
    req.userRole = await getClassRole(teacherId, student.classId);
    req.hasEditAccess = true;

    next();
  } catch (error) {
    console.error("Student class edit access verification failed:", error);
    res.status(500).json({ 
      message: "Internal server error" 
    });
  }
};

// Backward compatibility exports
export const verifyClassOwnership = verifyClassEditAccess;
export const verifyStudentClassOwnership = verifyStudentClassEditAccess;