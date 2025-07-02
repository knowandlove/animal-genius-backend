import { Router } from 'express';
import { supabaseAnon as supabase, supabaseAdmin } from '../supabase-clients';
import { requireAuth } from '../middleware/auth';
import { removeSession, getSessionCount } from '../middleware/session-tracker';
import { getAuthMetrics } from '../middleware/auth-monitor';
import { getCacheStats } from '../middleware/profile-cache';

// Debug: Check if supabase client is initialized
if (process.env.NODE_ENV === 'development') {
  console.log('Auth route loading, supabase client:', !!supabase);
  console.log('Supabase auth object:', !!supabase?.auth);
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

// Helper to create JWT for backward compatibility
function createAppToken(user: any, profile: any) {
  // For now, we'll return the Supabase session token
  // Later we can create our own JWT if needed
  return {
    userId: user.id,
    email: user.email,
    isAdmin: profile.isAdmin || false
  };
}

// Teacher registration - integrates with Supabase Auth
router.post('/register', authLimiter, async (req, res) => {
  try {
    // Validate request body
    const userData = registrationSchema.parse(req.body);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Registration attempt for:', userData.email);
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
      console.error('Supabase auth error:', authError);
      console.error('Full error details:', JSON.stringify(authError, null, 2));
      if (authError.message.includes('already registered')) {
        return res.status(400).json({ message: "User already exists with this email" });
      }
      return res.status(400).json({ message: authError.message });
    }

    if (!authData.user) {
      return res.status(400).json({ message: "Registration failed" });
    }

    // Check if email confirmation is required
    if (!authData.session) {
      // User created but needs email verification
      return res.json({
        requiresEmailVerification: true,
        message: "Registration successful! Please check your email to verify your account.",
        user: {
          id: authData.user.id,
          email: authData.user.email
        }
      });
    }

    // Get the created profile
    const profile = await getProfileById(authData.user.id);
    
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
  } catch (error) {
    console.error("Registration error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Invalid registration data", 
        errors: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    res.status(400).json({ message: "Registration failed" });
  }
});

// Teacher login - uses Supabase Auth
router.post('/login', authLimiter, async (req, res) => {
  try {
    // Validate request body
    const { email, password } = loginSchema.parse(req.body);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Login attempt for:', email);
    }
    
    // Sign in with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      console.error('Login error:', authError);
      console.error('Full error:', JSON.stringify(authError, null, 2));
      
      // Check for specific error cases
      if (authError.message?.includes('Email not confirmed')) {
        return res.status(401).json({ 
          message: "Please verify your email before logging in. Check your inbox for the verification link." 
        });
      }
      
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!authData.user || !authData.session) {
      console.error('No user or session in auth data');
      return res.status(401).json({ message: "Login failed" });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Supabase login successful, getting profile for:', authData.user.id);
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
      if (process.env.NODE_ENV === 'development') {
        console.error('Profile not found, using user metadata:', profileError);
      }
      
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
  } catch (error) {
    console.error("Login error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Invalid login data", 
        errors: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    res.status(500).json({ message: "Login failed" });
  }
});

// Refresh token - uses Supabase Auth
router.post('/refresh-token', async (req, res) => {
  try {
    // Validate request body
    const { refreshToken } = refreshTokenSchema.parse(req.body);
    
    // Refresh session with Supabase
    const { data: authData, error: authError } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (authError || !authData.session) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }
    
    res.json({
      token: authData.session.access_token,
      refreshToken: authData.session.refresh_token
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Invalid request data", 
        errors: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

// Logout - invalidates Supabase session
router.post('/logout', requireAuth, async (req, res) => {
  try {
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
          console.error("Sign out error:", signOutError);
        }
      }
    }
    
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    // Still return success to clear client-side session
    res.json({ message: "Logged out successfully" });
  }
});

// Password reset request
router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    // Validate request body
    const { email } = forgotPasswordSchema.parse(req.body);
    
    // Send password reset email via Supabase
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`
    });
    
    if (error) {
      console.error('Password reset error:', error);
      // Don't reveal if email exists or not
    }
    
    res.json({ message: "If the email exists, a password reset link has been sent" });
  } catch (error) {
    console.error("Password reset error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Invalid request data", 
        errors: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    res.status(500).json({ message: "Failed to process password reset" });
  }
});

// Update password with reset token
router.post('/reset-password', async (req, res) => {
  try {
    // Validate request body
    const { token, password } = resetPasswordSchema.parse(req.body);
    
    // First, we need to exchange the recovery token for a session
    const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'recovery',
    });
    
    if (sessionError || !sessionData.session) {
      console.error('Session verification error:', sessionError);
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }
    
    // Now update the password using the admin client with the user's ID
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      sessionData.user.id,
      { password: password }
    );
    
    if (updateError) {
      console.error('Password update error:', updateError);
      return res.status(400).json({ message: "Failed to update password" });
    }
    
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Password reset error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Invalid request data", 
        errors: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    res.status(500).json({ message: "Failed to reset password" });
  }
});

// Performance metrics endpoint (admin only, development only)
router.get('/metrics', requireAuth, async (req, res) => {
  if (process.env.NODE_ENV !== 'development' || !req.user?.isAdmin) {
    return res.status(404).json({ message: 'Not found' });
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
});

export default router;
