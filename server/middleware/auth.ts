import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable must be set");
}

// Export requireAuth as the main authentication middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error("JWT verification error:", err.message);
    }
    return res.status(403).json({ message: "Invalid token" });
  }
}

// Alias for backward compatibility
export const authenticateToken = requireAuth;
