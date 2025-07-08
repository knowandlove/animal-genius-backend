/**
 * Unified Authentication Middleware
 * 
 * Consolidates teacher and student authentication through Supabase Auth
 * with JIT provisioning support
 */

import { Request, Response, NextFunction } from 'express';
import { supabaseAnon } from '../supabase-clients';
import { getCachedProfile } from './profile-cache';
import { sessionTracker } from './session-tracker';
import { authPerformanceMonitor } from './auth-monitor';
import { createSecureLogger } from '../utils/secure-logger';
import { migrateStudentSession } from '../services/jit-provisioning';
import jwt from 'jsonwebtoken';

const logger = createSecureLogger('UnifiedAuth');

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        email: string;
        role: 'teacher' | 'student';
        isAdmin: boolean;
        studentId?: string; // For backward compatibility
        classId?: string; // For students
      };
    }
  }
}

/**
 * Unified authentication middleware
 * Handles both Supabase tokens and legacy student JWT tokens
 */
export async function requireUnifiedAuth(req: Request, res: Response, next: NextFunction) {
  // Start performance monitoring
  authPerformanceMonitor(req, res, () => {});
  
  try {
    // Check for Supabase auth token first
    const authHeader = req.headers.authorization;
    const supabaseToken = authHeader?.split(' ')[1];
    
    if (supabaseToken) {
      return await handleSupabaseAuth(req, res, next, supabaseToken);
    }
    
    // Check for legacy student session cookie
    const studentToken = req.cookies.student_session;
    if (studentToken) {
      return await handleLegacyStudentAuth(req, res, next, studentToken);
    }
    
    // No valid authentication found
    return res.status(401).json({ message: 'Authentication required' });
  } catch (error) {
    logger.error('Authentication error', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ message: 'Authentication failed' });
  }
}

/**
 * Handle Supabase authentication
 */
async function handleSupabaseAuth(req: Request, res: Response, next: NextFunction, token: string) {
  try {
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    
    if (error || !user) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    
    // Get cached profile
    const profile = await getCachedProfile(user.id);
    
    if (!profile) {
      return res.status(403).json({ message: 'Profile not found' });
    }
    
    // Determine role from user metadata or profile
    const role = user.user_metadata?.role || (profile.metadata?.role as string) || 'teacher';
    
    // Set unified auth data
    req.auth = {
      userId: user.id,
      email: user.email || profile.email,
      role: role as 'teacher' | 'student',
      isAdmin: profile.isAdmin || false,
      studentId: user.user_metadata?.student_id,
      classId: user.user_metadata?.class_id
    };
    
    // For backward compatibility, also set req.user for teacher routes
    if (role === 'teacher') {
      req.user = {
        userId: user.id,
        email: user.email || profile.email,
        isAdmin: profile.isAdmin || false
      };
      req.profile = profile;
    }
    
    // For backward compatibility, set req.studentId for student routes
    if (role === 'student' && user.user_metadata?.student_id) {
      req.studentId = user.user_metadata.student_id;
    }
    
    // Track session
    sessionTracker(req, res, () => {});
    
    next();
  } catch (error) {
    logger.error('Supabase auth error', { error });
    return res.status(403).json({ message: 'Invalid token' });
  }
}

/**
 * Handle legacy student JWT authentication
 * Automatically migrates to Supabase on successful auth
 */
async function handleLegacyStudentAuth(req: Request, res: Response, next: NextFunction, token: string) {
  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }
    
    // Verify legacy JWT
    const decoded = jwt.verify(token, JWT_SECRET) as { studentId: string };
    
    // Attempt to migrate to Supabase
    const migration = await migrateStudentSession(decoded.studentId);
    
    if (migration.success && migration.session) {
      // Migration successful - set new Supabase auth cookie/header
      logger.info('Successfully migrated student to Supabase auth', { studentId: decoded.studentId });
      
      // Clear old cookie
      res.clearCookie('student_session');
      
      // The frontend should handle the new auth token from the migration
      // For now, continue with legacy auth
    }
    
    // Set auth data for legacy student
    req.auth = {
      userId: decoded.studentId, // Use student ID as user ID for now
      email: `student-${decoded.studentId}@internal.animalgenius.com`,
      role: 'student',
      isAdmin: false,
      studentId: decoded.studentId
    };
    
    // For backward compatibility
    req.studentId = decoded.studentId;
    
    next();
  } catch (error) {
    logger.error('Legacy student auth error', { error });
    res.clearCookie('student_session');
    return res.status(401).json({ error: 'Session expired. Please enter your passport code again.' });
  }
}

/**
 * Role-based middleware generators
 */
export function requireRole(role: 'teacher' | 'student') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (req.auth.role !== role) {
      return res.status(403).json({ message: `${role} access required` });
    }
    
    next();
  };
}

export const requireTeacher = requireRole('teacher');
export const requireStudent = requireRole('student');

/**
 * Admin requirement middleware
 */
export function requireUnifiedAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth || !req.auth.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  next();
}

/**
 * Optional unified auth - doesn't fail if no auth present
 */
export async function optionalUnifiedAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const supabaseToken = authHeader?.split(' ')[1];
  const studentToken = req.cookies.student_session;
  
  if (!supabaseToken && !studentToken) {
    return next();
  }
  
  // Try to authenticate but don't fail if it doesn't work
  try {
    await requireUnifiedAuth(req, res, () => {
      next();
    });
  } catch (error) {
    // Continue without auth
    next();
  }
}