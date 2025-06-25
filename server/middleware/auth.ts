import type { Request, Response, NextFunction } from "express";
import { supabase } from '../supabase';

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
      supabaseUser?: any;
    }
  }
}

// Main authentication middleware for Supabase Auth
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }
  
  try {
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(403).json({ message: "Invalid token" });
    }
    
    // Get user profile for additional data
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    // Set user data on request - maintain backward compatibility
    req.user = {
      userId: user.id,
      email: user.email,
      is_admin: profile?.is_admin || false
    };
    
    req.supabaseUser = user;
    
    next();
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
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(403).json({ message: "Invalid token" });
    }
    
    // Get user profile to check admin status
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    
    if (!profile?.is_admin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    // Set user data on request
    req.user = {
      userId: user.id,
      email: user.email,
      is_admin: true
    };
    
    req.supabaseUser = user;
    
    next();
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
    // Try to verify token with Supabase
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (user) {
      // Get user profile for additional data
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      req.user = {
        userId: user.id,
        email: user.email,
        is_admin: profile?.is_admin || false
      };
      
      req.supabaseUser = user;
    }
  } catch (err: any) {
    // Ignore errors, continue without user
  }
  
  next();
}
