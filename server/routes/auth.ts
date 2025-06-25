import { Router } from 'express';
import { supabase } from '../supabase';
import { insertUserSchema, updateUserProfileSchema, updatePasswordSchema } from '@shared/schema';
import { storage, getProfileById, updateLastLogin } from '../storage';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimiter';
import { z } from 'zod';

const router = Router();

// Helper to create JWT for backward compatibility
function createAppToken(user: any, profile: any) {
  // For now, we'll return the Supabase session token
  // Later we can create our own JWT if needed
  return {
    userId: user.id,
    email: user.email,
    is_admin: profile.is_admin || false
  };
}

// Teacher registration - integrates with Supabase Auth
router.post('/register', authLimiter, async (req, res) => {
  try {
    const userData = insertUserSchema.parse(req.body);
    
    console.log('Registration attempt for:', userData.email);
    
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
    res.status(400).json({ message: "Invalid registration data" });
  }
});

// Teacher login - uses Supabase Auth
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('Login attempt for:', email);
    
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
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

    console.log('Supabase login successful, getting profile for:', authData.user.id);

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
      console.error('Profile not found, using user metadata:', profileError);
      
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
    res.status(500).json({ message: "Login failed" });
  }
});

// Refresh token - uses Supabase Auth
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token required" });
    }
    
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
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

// Logout - invalidates Supabase session
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      // Sign out from Supabase
      await supabase.auth.admin.signOut(token);
    }
    
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    // Still return success even if there's an error
    res.json({ message: "Logged out successfully" });
  }
});

// Password reset request
router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }
    
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
    res.status(500).json({ message: "Failed to process password reset" });
  }
});

// Update password with reset token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ message: "Token and password required" });
    }
    
    // Update password via Supabase
    const { error } = await supabase.auth.updateUser({
      password: password
    });
    
    if (error) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }
    
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Password update error:", error);
    res.status(500).json({ message: "Failed to update password" });
  }
});

export default router;
