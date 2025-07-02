import type { Request, Response, NextFunction } from "express";
import type { Profile } from '@shared/schema';
import { supabaseAdmin, supabaseAnon } from '../supabase-clients';
import { db } from '../db';
import { profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getCachedProfile } from './profile-cache';
import { sessionTracker } from './session-tracker';
import { authPerformanceMonitor } from './auth-monitor';

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string; // Now using UUID
        email: string;
        isAdmin: boolean;
      };
      profile?: Profile;
    }
  }
}

// Main authentication middleware for Supabase Auth
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Start performance monitoring
  authPerformanceMonitor(req, res, () => {});
  
  const authHeader = req.headers.authorization;
  if (process.env.NODE_ENV === 'development') {
    console.log('Auth header received:', authHeader ? authHeader.substring(0, 50) + '...' : 'None');
  }
  
  const token = authHeader?.split(' ')[1];
  if (process.env.NODE_ENV === 'development') {
    console.log('Token extracted:', token ? token.substring(0, 50) + '...' : 'None');
  }
  
  if (!token) {
    if (process.env.NODE_ENV === 'development') {
      console.log('No token found in authorization header');
    }
    return res.status(401).json({ message: "Access token required" });
  }
  
  try {
    // Verify token with Supabase using anon client
    if (process.env.NODE_ENV === 'development') {
      console.log('Verifying token with Supabase...');
    }
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    
    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Supabase auth error:', error);
        console.error('Error details:', {
          message: error.message,
          status: error.status,
          code: error.code
        });
      }
      return res.status(403).json({ message: "Invalid token" });
    }
    
    if (!user) {
      if (process.env.NODE_ENV === 'development') {
        console.log('No user returned from Supabase');
      }
      return res.status(403).json({ message: "Invalid token" });
    }
    
    try {
      const profile = await getCachedProfile(user.id);
      
      if (!profile) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Profile not found for user:', user.id);
        }
        return res.status(403).json({ message: "Profile not found. Please complete your profile." });
      }
      
      // Set user data on request
      req.user = {
        userId: user.id, // UUID from Supabase
        email: user.email || profile.email,
        isAdmin: profile.isAdmin || false
      };
      
      req.profile = profile;
      
      // Track session after authentication
      sessionTracker(req, res, () => {});
      
      next();
    } catch (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ message: "Database error" });
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error("Auth verification error:", err instanceof Error ? err.message : err);
    }
    return res.status(403).json({ message: "Invalid token" });
  }
}

// Alias for backward compatibility
export const authenticateToken = requireAuth;

// Admin authentication middleware
export async function authenticateAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }
  
  try {
    // Verify token with Supabase using anon client
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    
    if (error || !user) {
      return res.status(403).json({ message: "Invalid token" });
    }
    
    // Get user profile to check admin status using cached lookup
    try {
      const profile = await getCachedProfile(user.id);
      
      if (!profile?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      // Set user data on request
      req.user = {
        userId: user.id, // UUID from Supabase
        email: user.email || profile.email,
        isAdmin: true
      };
      
      req.profile = profile;
      
      // Track session after admin authentication
      sessionTracker(req, res, () => {});
      
      next();
    } catch (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ message: "Database error" });
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error("Admin auth verification error:", err instanceof Error ? err.message : err);
    }
    return res.status(403).json({ message: "Invalid token" });
  }
}

// Helper middleware to optionally authenticate
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    // No token, continue without user
    return next();
  }
  
  try {
    // Try to verify token with Supabase using anon client
    const { data: { user } } = await supabaseAnon.auth.getUser(token);
    
    if (user) {
      // Get user profile using cached lookup
      const profile = await getCachedProfile(user.id);
      
      if (profile) {
        req.user = {
          userId: user.id,
          email: user.email || profile.email,
          isAdmin: profile.isAdmin || false
        };
        
        req.profile = profile;
      }
    }
  } catch (err) {
    // Ignore errors, continue without user
  }
  
  next();
}

// Middleware to check if authenticated user is admin (use after requireAuth)
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    // This middleware assumes requireAuth has already been called
    if (!req.user?.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Use cached profile if available
    if (req.profile) {
      if (!req.profile.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      return next();
    }

    // Otherwise fetch from database
    const [user] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, req.user.userId))
      .limit(1);

    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
