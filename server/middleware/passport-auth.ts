import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from '../supabase-clients';
import { createSecureLogger, sanitizeError } from '../utils/secure-logger';

// Rate limiting for brute force protection
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

const logger = createSecureLogger('PassportAuth');

// Type for the validate_student_login RPC response
interface StudentLoginData {
  student_id: string;
  user_id: string;
  class_id: string;
  student_name: string;
  school_year: string;
  animal_type_code: string;
  genius_type_code: string;
}

// Extend Request type to include student (matching unified-auth interface)
declare global {
  namespace Express {
    interface Request {
      student?: {
        id: string;
        classId: string;
        studentName: string;
        passportCode: string;
      };
    }
  }
}

/**
 * Middleware to authenticate students using passport codes
 * Students should include their passport code in the X-Passport-Code header
 */
export async function requireStudentAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Get passport code from header
    const passportCode = req.headers['x-passport-code'] as string;
    
    if (!passportCode) {
      logger.info('Student auth failed: No passport code provided');
      return res.status(401).json({ 
        error: 'Authentication required. Please provide your passport code in the X-Passport-Code header.' 
      });
    }

    // SECURITY FIX: Check for rate limiting (brute force protection)
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const attempts = failedAttempts.get(clientIP);
    
    if (attempts && attempts.count >= MAX_ATTEMPTS) {
      const timeSinceLastAttempt = now - attempts.lastAttempt;
      if (timeSinceLastAttempt < LOCKOUT_DURATION) {
        const remainingLockout = Math.ceil((LOCKOUT_DURATION - timeSinceLastAttempt) / 1000 / 60);
        logger.warn('IP blocked due to too many failed attempts', { clientIP });
        return res.status(429).json({ 
          error: `Too many failed attempts. Try again in ${remainingLockout} minutes.` 
        });
      } else {
        // Reset after lockout period
        failedAttempts.delete(clientIP);
      }
    }

    // Validate passport code format (XXX-XXX where X is uppercase letter or number)
    if (!/^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(passportCode)) {
      // Track failed attempt
      const currentAttempts = failedAttempts.get(clientIP) || { count: 0, lastAttempt: 0 };
      failedAttempts.set(clientIP, { count: currentAttempts.count + 1, lastAttempt: now });
      
      logger.info('Student auth failed: Invalid passport code format', { passportCode });
      return res.status(401).json({ 
        error: 'Invalid passport code format. Expected format: ABC-123' 
      });
    }

    // Validate passport code against database using the optimized RPC function
    const { data: studentData, error } = await supabaseAdmin
      .rpc('validate_student_login', { p_passport_code: passportCode })
      .single() as { data: StudentLoginData | null, error: any };

    if (error || !studentData) {
      // SECURITY FIX: Track failed login attempt
      const currentAttempts = failedAttempts.get(clientIP) || { count: 0, lastAttempt: 0 };
      failedAttempts.set(clientIP, { count: currentAttempts.count + 1, lastAttempt: now });
      
      logger.info('Student auth failed: Invalid passport code', { 
        passportCode, 
        error: sanitizeError(error) 
      });
      return res.status(401).json({ 
        error: 'Invalid passport code. Please check your code and try again.' 
      });
    }
    
    // SECURITY FIX: Clear failed attempts on successful login
    if (failedAttempts.has(clientIP)) {
      failedAttempts.delete(clientIP);
    }

    // Add student data to request object for use in route handlers
    // The optimized function now returns all data in one call
    req.student = {
      id: studentData.student_id,
      studentName: studentData.student_name,
      classId: studentData.class_id,
      passportCode: passportCode
    };

    logger.info('Student authenticated successfully', { 
      studentId: req.student.id,
      studentName: req.student.studentName 
    });

    next();
  } catch (error) {
    logger.error('Student authentication error:', sanitizeError(error));
    return res.status(500).json({ 
      error: 'Authentication service unavailable. Please try again later.' 
    });
  }
}

/**
 * Optional student authentication - doesn't fail if no passport code provided
 * Useful for endpoints that work for both authenticated and anonymous users
 */
export async function optionalStudentAuth(req: Request, res: Response, next: NextFunction) {
  const passportCode = req.headers['x-passport-code'] as string;
  
  if (!passportCode) {
    // No passport code, continue without student data
    return next();
  }
  
  try {
    // Validate format
    if (!/^[A-Z]{3}-[A-Z0-9]{3}$/.test(passportCode)) {
      // Invalid format, continue without student data
      return next();
    }

    // Try to validate passport code
    const { data: studentData, error } = await supabaseAdmin
      .rpc('validate_student_login', { p_passport_code: passportCode })
      .single() as { data: StudentLoginData | null, error: any };

    if (!error && studentData) {
      // Add student data to request using optimized data from RPC
      req.student = {
        id: studentData.student_id,
        studentName: studentData.student_name,
        classId: studentData.class_id,
        passportCode: passportCode
      };
    }
  } catch (error) {
    // Ignore errors, continue without student data
    logger.warn('Optional student auth failed, continuing without auth', { 
      error: sanitizeError(error) 
    });
  }
  
  next();
}

/**
 * Middleware to ensure student belongs to a specific class
 * Use after requireStudentAuth
 */
export function requireStudentInClass(req: Request, res: Response, next: NextFunction) {
  if (!req.student) {
    return res.status(401).json({ 
      error: 'Student authentication required' 
    });
  }

  const classId = req.params.classId || req.body.classId;
  
  if (!classId) {
    return res.status(400).json({ 
      error: 'Class ID required' 
    });
  }

  if (req.student.classId !== classId) {
    logger.warn('Student attempted to access different class', {
      studentId: req.student.id,
      studentClass: req.student.classId,
      requestedClass: classId
    });
    
    return res.status(403).json({ 
      error: 'You do not have access to this class' 
    });
  }

  next();
}