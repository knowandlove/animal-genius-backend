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
// Removed migration imports - no longer needed with Custom JWT Authorizer pattern

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
 * Handles Supabase tokens (both teacher and student JWTs)
 */
export async function requireUnifiedAuth(req: Request, res: Response, next: NextFunction) {
  // Start performance monitoring
  authPerformanceMonitor(req, res, () => {});
  
  try {
    // Check for auth token
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Handle all auth through Supabase (including custom student JWTs)
    return await handleSupabaseAuth(req, res, next, token);
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
    
    // Get cached profile - for students this might not exist (anonymous users)
    const profile = await getCachedProfile(user.id);
    
    // Determine role from user metadata or app metadata
    // Students use app_metadata (set by system), teachers use user_metadata
    let role = user.app_metadata?.role || user.user_metadata?.role;
    const isAnonymous = user.is_anonymous || false;
    
    // Fallback: If no role is set but profile exists, assume this is a teacher
    if (!role && profile) {
      role = 'teacher';
      logger.info('Setting fallback role as teacher for user with profile', { userId: user.id });
    }
    
    // Only require profile for teachers
    if (!profile && role === 'teacher') {
      return res.status(403).json({ message: 'Teacher profile not found' });
    }
    
    // For anonymous users (students), role is in app_metadata
    if (!role || (role !== 'teacher' && role !== 'student')) {
      logger.error('User missing or invalid role in metadata', { userId: user.id, role, isAnonymous });
      return res.status(403).json({ message: 'User profile is not configured correctly. Please contact support.' });
    }
    
    // Set unified auth data
    // For students, check app_metadata first (set by system), then user_metadata
    const studentId = user.app_metadata?.student_id || user.user_metadata?.student_id || user.user_metadata?.studentId;
    const classId = user.app_metadata?.class_id || user.user_metadata?.class_id || user.user_metadata?.classId;
    
    req.auth = {
      userId: user.id,
      email: user.email || profile?.email || `student-${studentId}@animalgenius.local`,
      role: role as 'teacher' | 'student',
      isAdmin: profile?.isAdmin || false,
      studentId: studentId,
      classId: classId
    };
    
    // For backward compatibility, also set req.user for teacher routes
    if (role === 'teacher') {
      req.user = {
        userId: user.id,
        email: user.email || profile?.email || '',
        isAdmin: profile?.isAdmin || false
      };
      req.profile = profile || undefined;
    }
    
    // For backward compatibility, set req.student for student routes  
    if (role === 'student' && studentId) {
      req.student = {
        id: studentId,
        studentName: user.user_metadata?.student_name || user.user_metadata?.name || 'Unknown Student',
        classId: classId || '',
        passportCode: user.user_metadata?.passport_code || ''
      };
    }
    
    // Track session
    sessionTracker(req, res, () => {});
    
    next();
  } catch (error) {
    logger.error('Supabase auth error', { error });
    return res.status(403).json({ message: 'Invalid token' });
  }
}

// Legacy student auth handler removed - all auth now goes through Supabase

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
  const token = authHeader?.split(' ')[1];
  
  if (!token) {
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