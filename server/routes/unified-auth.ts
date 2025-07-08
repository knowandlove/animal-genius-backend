/**
 * Unified Authentication Routes
 * 
 * Provides authentication endpoints for both teachers and students
 * using Supabase Auth with JIT provisioning
 */

import { Router } from 'express';
import { z } from 'zod';
import { supabaseAnon } from '../supabase-clients';
import { provisionUser, verifyPassportCode } from '../services/jit-provisioning';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimiter';
import { checkPassportLockout, trackFailedAttempt, clearFailedAttempts } from '../middleware/passport-lockout';
import { asyncWrapper } from '../utils/async-wrapper';
import { AuthenticationError, ValidationError, BusinessError, ErrorCode } from '../utils/errors';
import { createSecureLogger } from '../utils/secure-logger';

const router = Router();
const logger = createSecureLogger('UnifiedAuth');

// Validation schemas
const studentAuthSchema = z.object({
  passportCode: z.string().regex(/^[A-Z]{3}-[A-Z0-9]{3,4}$/, "Invalid passport code format"),
  classCode: z.string().optional()
});

const teacherLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

/**
 * POST /api/unified-auth/student/login
 * Authenticate student with passport code
 * Creates Supabase account if needed (JIT provisioning)
 */
router.post('/student/login', authLimiter, checkPassportLockout, asyncWrapper(async (req, res, next) => {
  const { passportCode, classCode } = studentAuthSchema.parse(req.body);
  
  logger.debug('Student login attempt', { passportCode: passportCode.substring(0, 3) + '-XXX' });
  
  // Verify passport code
  const verification = await verifyPassportCode(passportCode, classCode);
  
  if (!verification.valid) {
    // Track failed attempt
    const isLocked = trackFailedAttempt(passportCode);
    if (isLocked) {
      throw new AuthenticationError('Too many failed attempts. Please try again later.', ErrorCode.AUTH_004);
    }
    throw new AuthenticationError(verification.error || 'Invalid passport code', ErrorCode.AUTH_001);
  }
  
  // Clear failed attempts on successful verification
  clearFailedAttempts(passportCode);
  
  // Provision student in Supabase
  try {
    const result = await provisionUser({
      role: 'student',
      metadata: {
        studentId: verification.student.id,
        studentName: verification.student.studentName,
        classId: verification.student.classId,
        passportCode: verification.student.passportCode
      }
    });
    
    logger.info('Student provisioned successfully', { 
      studentId: result.student.id,
      isNewUser: result.isNewUser 
    });
    
    // For now, return a success response
    // In production, we'd return a Supabase session token
    res.json({
      success: true,
      studentName: result.student.studentName,
      message: 'Welcome to Animal Genius!',
      // Include migration info for frontend
      migrationStatus: {
        provisioned: true,
        isNewUser: result.isNewUser,
        // Don't expose actual session in response for security
        requiresTokenRefresh: true
      }
    });
    
    // Set legacy cookie for backward compatibility during migration
    if (process.env.ENABLE_LEGACY_STUDENT_AUTH === 'true') {
      const jwt = require('jsonwebtoken');
      const legacyToken = jwt.sign(
        { studentId: result.student.id },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' }
      );
      
      res.cookie('student_session', legacyToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });
    }
  } catch (error) {
    logger.error('Student provisioning failed', { error });
    throw new BusinessError('Failed to create student session', ErrorCode.BIZ_001);
  }
}));

/**
 * POST /api/unified-auth/teacher/login
 * Standard teacher login (existing Supabase flow)
 */
router.post('/teacher/login', authLimiter, asyncWrapper(async (req, res, next) => {
  const { email, password } = teacherLoginSchema.parse(req.body);
  
  // Use existing Supabase auth
  const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
    email,
    password
  });
  
  if (authError || !authData.session) {
    logger.warn('Teacher login failed', { email, error: authError?.message });
    throw new AuthenticationError('Invalid credentials', ErrorCode.AUTH_001);
  }
  
  // Ensure profile exists (JIT provisioning for teachers)
  try {
    const result = await provisionUser({
      role: 'teacher',
      email: email,
      metadata: {
        firstName: authData.user.user_metadata?.first_name,
        lastName: authData.user.user_metadata?.last_name,
        schoolOrganization: authData.user.user_metadata?.school_organization,
        roleTitle: authData.user.user_metadata?.role_title
      }
    });
    
    res.json({
      token: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      user: {
        id: authData.user.id,
        email: result.profile.email,
        firstName: result.profile.firstName,
        lastName: result.profile.lastName,
        isAdmin: result.profile.isAdmin
      }
    });
  } catch (error) {
    logger.error('Teacher provisioning failed', { error });
    throw new BusinessError('Failed to complete login', ErrorCode.BIZ_001);
  }
}));

/**
 * GET /api/unified-auth/session
 * Check current session status
 */
router.get('/session', asyncWrapper(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];
  
  if (!token) {
    // Check for legacy student session
    const studentToken = req.cookies.student_session;
    if (studentToken) {
      res.json({
        authenticated: true,
        type: 'legacy_student',
        migrationRequired: true
      });
      return;
    }
    
    res.json({ authenticated: false });
    return;
  }
  
  // Verify Supabase token
  const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
  
  if (error || !user) {
    res.json({ authenticated: false });
    return;
  }
  
  res.json({
    authenticated: true,
    type: 'supabase',
    role: user.user_metadata?.role || 'teacher',
    userId: user.id,
    email: user.email
  });
}));

/**
 * POST /api/unified-auth/logout
 * Unified logout endpoint
 */
router.post('/logout', asyncWrapper(async (req, res, next) => {
  // Clear any legacy cookies
  res.clearCookie('student_session');
  
  // Sign out from Supabase if token present
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];
  
  if (token) {
    try {
      await supabaseAnon.auth.signOut();
    } catch (error) {
      logger.error('Supabase signout error', { error });
    }
  }
  
  res.json({ message: 'Logged out successfully' });
}));

export default router;