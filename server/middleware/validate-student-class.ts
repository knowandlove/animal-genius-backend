import type { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { students, quizSubmissions } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Middleware to validate that a passport code belongs to a valid student
 * and optionally that they belong to a specific class
 */
export async function validateStudentAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const passportCode = req.params.passportCode || req.body.passportCode;
    
    if (!passportCode) {
      return res.status(400).json({ message: 'Passport code required' });
    }
    
    // Get the student's class information
    const [student] = await db
      .select({
        id: students.id,
        classId: students.classId,
        studentName: students.studentName
      })
      .from(students)
      .where(eq(students.passportCode, passportCode))
      .limit(1);
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    // Attach student info to request for use in route handlers
    req.student = {
      id: student.id,
      classId: student.classId,
      studentName: student.studentName,
      passportCode
    };
    
    next();
  } catch (error) {
    console.error('Student validation error:', error);
    return res.status(500).json({ message: 'Failed to validate student access' });
  }
}

/**
 * Middleware to ensure students can only access data within their own class
 * Must be used AFTER validateStudentAccess
 */
export async function requireSameClass(req: Request, res: Response, next: NextFunction) {
  try {
    // Check if we're accessing another student's data
    const targetPassportCode = req.params.targetPassportCode || req.query.targetPassportCode;
    
    if (!targetPassportCode || targetPassportCode === req.student?.passportCode) {
      // Accessing own data, allow
      return next();
    }
    
    // Check if target student is in same class
    const [targetStudent] = await db
      .select({
        classId: students.classId
      })
      .from(students)
      .where(eq(students.passportCode, targetPassportCode as string))
      .limit(1);
    
    if (!targetStudent) {
      return res.status(404).json({ message: 'Target student not found' });
    }
    
    if (targetStudent.classId !== req.student?.classId) {
      return res.status(403).json({ message: 'Access denied: Students must be in the same class' });
    }
    
    next();
  } catch (error) {
    console.error('Class validation error:', error);
    return res.status(500).json({ message: 'Failed to validate class access' });
  }
}

/**
 * Middleware to validate student session and ensure they can only access their own data
 * For use with authenticated endpoints
 */
export async function validateOwnDataAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const passportCode = req.params.passportCode || req.body.passportCode;
    const studentId = req.studentId; // From requireStudentSession
    
    if (!passportCode || !studentId) {
      return res.status(400).json({ message: 'Invalid request' });
    }
    
    // Verify the passport code matches the authenticated student
    const [student] = await db
      .select({
        passportCode: students.passportCode
      })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);
    
    if (!student || student.passportCode !== passportCode) {
      return res.status(403).json({ message: 'Access denied: You can only access your own data' });
    }
    
    next();
  } catch (error) {
    console.error('Own data validation error:', error);
    return res.status(500).json({ message: 'Failed to validate data access' });
  }
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      student?: {
        id: string;  // UUID
        classId: string;  // UUID
        studentName: string;
        passportCode: string;
      };
    }
  }
}