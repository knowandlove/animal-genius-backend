import type { Request, Response, NextFunction } from "express";
import type { Profile } from '@shared/schema';
import { supabaseAdmin, supabaseAnon } from '../supabase-clients';
import { db } from '../db';
import { profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string; // Now using UUID
        email: string;
        is_admin: boolean;
      };
      profile?: Profile;
    }
  }
}

// Main authentication middleware for Supabase Auth
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  console.log('Auth header received:', authHeader?.substring(0, 50) + '...');
  
  const token = authHeader?.split(' ')[1];
  
  if (!token) {
    console.log('No token found in authorization header');
    return res.status(401).json({ message: "Access token required" });
  }
  
  console.log('Token extracted:', token.substring(0, 50) + '...');
  
  try {
    // Verify token with Supabase using anon client
    console.log('Verifying token with Supabase...');
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    
    if (error) {
      console.error('Supabase auth error:', error);
      return res.status(403).json({ message: "Invalid token" });
    }
    
    if (!user) {
      console.log('No user returned from Supabase');
      return res.status(403).json({ message: "Invalid token" });
    }
    
    // Get user profile for additional data using Drizzle ORM
    console.log('Looking for profile with ID:', user.id);
    
    try {
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1);
      
      console.log('Profile query result:', profile ? 'Found' : 'Not found');
      
      if (!profile) {
        console.error('Profile not found for user:', user.id);
        return res.status(403).json({ message: "Profile not found. Please complete your profile." });
      }
      
      // Set user data on request
      req.user = {
        userId: user.id, // UUID from Supabase
        email: user.email || profile.email,
        is_admin: profile.isAdmin || false
      };
      
      req.profile = profile;
      
      next();
    } catch (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ message: "Database error" });
    }
  } catch (err: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error("Auth verification error:", err.message);
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
    
    // Get user profile to check admin status using Drizzle ORM
    try {
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1);
      
      if (!profile?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      // Set user data on request
      req.user = {
        userId: user.id, // UUID from Supabase
        email: user.email || profile.email,
        is_admin: true
      };
      
      req.profile = profile;
      
      next();
    } catch (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ message: "Database error" });
    }
  } catch (err: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error("Admin auth verification error:", err.message);
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
      // Get user profile for additional data using admin client
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        req.user = {
          userId: user.id,
          email: user.email || profile.email,
          is_admin: profile.is_admin || false
        };
        
        req.profile = profile;
      }
    }
  } catch (err: any) {
    // Ignore errors, continue without user
  }
  
  next();
}
