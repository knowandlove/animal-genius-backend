import { Router } from 'express';
import { supabaseAnon as supabase, supabaseAdmin } from '../supabase-clients';
import { requireAuth } from '../middleware/auth';
import { removeSession, getSessionCount } from '../middleware/session-tracker';
import { getAuthMetrics } from '../middleware/auth-monitor';
import { getCacheStats } from '../middleware/profile-cache';
import { db } from '../db';
import { profiles } from '@shared/schema';
import { asyncWrapper } from '../utils/async-wrapper';
import { AuthenticationError, ValidationError, ConflictError, NotFoundError, InternalError, ErrorCode } from '../utils/errors';
import { createSecureLogger } from '../utils/secure-logger';

const logger = createSecureLogger('AuthRoutes');

// Debug: Check if supabase client is initialized
if (process.env.NODE_ENV === 'development') {
  logger.debug('Auth route loading', { 
    supabaseClient: !!supabase,
    supabaseAuth: !!supabase?.auth 
  });
}
// import { insertUserSchema, updateUserProfileSchema, updatePasswordSchema } from '@shared/schema';
import { getProfileById, updateLastLoginSupabase as updateLastLogin } from '../storage-supabase';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimiter';
import { z } from 'zod';
import { 
  registrationSchema, 
  loginSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema, 
  refreshTokenSchema 
} from '../validation/auth-schemas';

const router = Router();

// Teacher registration - integrates with Supabase Auth
router.post('/register', authLimiter, asyncWrapper(async (req, res, next) => {
  // Validate request body
  const userData = registrationSchema.parse(req.body);
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Registration attempt', { email: userData.email });
    }
    
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          first_name: userData.firstName,
          last_name: userData.lastName,
          school_organization: userData.schoolOrganization,
          role_title: userData.roleTitle,
          how_heard_about: userData.howHeardAbout,
          personality_animal: userData.personalityAnimal
        }
      }
    });

    if (authError) {
      logger.error('Supabase auth error during registration', { 
        email: userData.email,
        error: authError.message 
      });
      
      if (authError.message.includes('already registered')) {
        throw new ConflictError('User already exists with this email', ErrorCode.BIZ_006);
      }
      
      // Don't expose internal Supabase error messages
      throw new ValidationError('Registration failed. Please check your email and password.', ErrorCode.AUTH_001);
    }

    if (!authData.user) {
      throw new ValidationError('Registration failed', ErrorCode.AUTH_001);
    }

    // Check if email confirmation is required
    if (!authData.session) {
      // User created but needs email verification
      res.json({
        requiresEmailVerification: true,
        message: "Registration successful! Please check your email to verify your account.",
        user: {
          id: authData.user.id,
          email: authData.user.email
        }
      });
      return;
    }

    // Create profile in our database (Supabase doesn't auto-create it)
    let profile;
    try {
      profile = await getProfileById(authData.user.id);
    } catch (error) {
      // Profile doesn't exist, create it
      logger.debug('Creating new profile for user', { userId: authData.user.id });
      
      const [newProfile] = await db
        .insert(profiles)
        .values({
          id: authData.user.id,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          schoolOrganization: userData.schoolOrganization,
          roleTitle: userData.roleTitle,
          howHeardAbout: userData.howHeardAbout,
          personalityAnimal: userData.personalityAnimal,
          isAdmin: false
        })
        .returning();
        
      profile = newProfile;
    }
    
    res.json({
      token: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      user: {
        id: authData.user.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        personalityAnimal: profile.personalityAnimal,
        isAdmin: profile.isAdmin
      }
    });
}));

// Teacher login - uses Supabase Auth
router.post('/login', authLimiter, asyncWrapper(async (req, res, next) => {
  // Validate request body
  const { email, password } = loginSchema.parse(req.body);
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Login attempt', { email });
    }
    
    // Sign in with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      logger.error('Login error', { email, error: authError.message });
      
      // Check for specific error cases
      if (authError.message?.includes('Email not confirmed')) {
        throw new AuthenticationError(
          'Please verify your email before logging in. Check your inbox for the verification link.',
          ErrorCode.AUTH_001
        );
      }
      
      throw new AuthenticationError('Invalid credentials', ErrorCode.AUTH_001);
    }

    if (!authData.user || !authData.session) {
      logger.error('No user or session in auth data');
      throw new AuthenticationError('Login failed', ErrorCode.AUTH_001);
    }

    if (process.env.NODE_ENV === 'development') {
      logger.debug('Supabase login successful, getting profile', { userId: authData.user.id });
    }

    // Get user profile
    try {
      const profile = await getProfileById(authData.user.id);
      
      // Update last login
      await updateLastLogin(authData.user.id);
      
      res.json({
        token: authData.session.access_token,
        refreshToken: authData.session.refresh_token,
        user: {
          id: authData.user.id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          personalityAnimal: profile.personalityAnimal,
          isAdmin: profile.isAdmin
        }
      });
    } catch (profileError) {
      logger.debug('Profile not found, using user metadata');
      
      // Profile doesn't exist yet, use the metadata from Supabase
      const metadata = authData.user.user_metadata || {};
      
      res.json({
        token: authData.session.access_token,
        refreshToken: authData.session.refresh_token,
        user: {
          id: authData.user.id,
          firstName: metadata.first_name || 'Unknown',
          lastName: metadata.last_name || 'User',
          email: authData.user.email!,
          personalityAnimal: metadata.personality_animal,
          isAdmin: false
        }
      });
    }
}));

// Refresh token - uses Supabase Auth
router.post('/refresh-token', asyncWrapper(async (req, res, next) => {
  // Validate request body
  const { refreshToken } = refreshTokenSchema.parse(req.body);
  
  // Refresh session with Supabase
  const { data: authData, error: authError } = await supabase.auth.refreshSession({
    refresh_token: refreshToken
  });

  if (authError || !authData.session) {
    throw new AuthenticationError('Invalid refresh token', ErrorCode.AUTH_002);
  }
  
  res.json({
    token: authData.session.access_token,
    refreshToken: authData.session.refresh_token
  });
}));

// Logout - invalidates Supabase session
router.post('/logout', requireAuth, asyncWrapper(async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (token) {
    // Get the current session to find the user
    const { data: { user }, error: getUserError } = await supabase.auth.getUser(token);
    
    if (user && !getUserError) {
      // Clean up session tracking
      if (req.sessionId) {
        removeSession(user.id, req.sessionId);
      }
      
      // Sign out the user using their JWT token
      const { error: signOutError } = await supabase.auth.signOut();
      
      if (signOutError) {
        logger.error('Sign out error', { error: signOutError.message });
      }
    }
  }
  
  res.json({ message: "Logged out successfully" });
}));

// Password reset request
router.post('/forgot-password', passwordResetLimiter, asyncWrapper(async (req, res, next) => {
  // Validate request body
  const { email } = forgotPasswordSchema.parse(req.body);
  
  // Send password reset email via Supabase
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.FRONTEND_URL}/reset-password`
  });
  
  if (error) {
    logger.error('Password reset error', { email, error: error.message });
    // Don't reveal if email exists or not
  }
  
  res.json({ message: "If the email exists, a password reset link has been sent" });
}));

// Update password with reset token
router.post('/reset-password', asyncWrapper(async (req, res, next) => {
  // Validate request body
  const { token, password } = resetPasswordSchema.parse(req.body);
  
  // First, we need to exchange the recovery token for a session
  const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
    token_hash: token,
    type: 'recovery',
  });
  
  if (sessionError || !sessionData.session || !sessionData.user) {
    logger.error('Session verification error', { error: sessionError?.message });
    throw new AuthenticationError('Invalid or expired reset token', ErrorCode.AUTH_002);
  }
  
  // Now update the password using the admin client with the user's ID
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    sessionData.user.id,
    { password: password }
  );
  
  if (updateError) {
    logger.error('Password update error', { userId: sessionData.user.id, error: updateError.message });
    throw new InternalError('Failed to update password', ErrorCode.SYS_001);
  }
  
  res.json({ message: "Password updated successfully" });
}));

// Performance metrics endpoint (admin only, development only)
router.get('/metrics', requireAuth, asyncWrapper(async (req, res, next) => {
  if (process.env.NODE_ENV !== 'development' || !req.user?.isAdmin) {
    throw new NotFoundError('Resource not found', ErrorCode.RES_001);
  }
  
  const authMetrics = getAuthMetrics();
  const cacheStats = getCacheStats();
  const userSessionCount = req.user ? getSessionCount(req.user.userId) : 0;
  
  res.json({
    auth: authMetrics,
    cache: cacheStats,
    sessions: {
      currentUser: userSessionCount
    },
    timestamp: new Date().toISOString()
  });
}));

export default router;
