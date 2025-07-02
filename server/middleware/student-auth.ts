import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables.");
  console.error("Server cannot start without JWT_SECRET. Please check your .env file.");
  // Use a fallback for development, but never for production
  if (process.env.NODE_ENV === 'development') {
    console.warn("Using temporary fallback JWT secret for development only!");
    // Don't exit in development, but log warning
  } else {
    process.exit(1);
  }
}

export interface StudentSessionPayload {
  studentId: string; // UUID of the student
  // No personal data - just the reference ID
}

declare global {
  namespace Express {
    interface Request {
      studentId?: string; // UUID
    }
  }
}

/**
 * Middleware to verify student session tokens
 * Used for all /api/island/me/* endpoints
 */
export function requireStudentSession(req: Request, res: Response, next: NextFunction) {
  console.log('Student auth middleware - cookies:', req.cookies);
  const token = req.cookies.student_session;

  if (!token) {
    console.log('No student_session cookie found');
    return res.status(401).json({ error: 'No session found. Please enter your passport code.' });
  }

  try {
    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'Server configuration error' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const payload = decoded as unknown as StudentSessionPayload;
    req.studentId = payload.studentId;
    next();
  } catch (error) {
    // Token expired or invalid
    res.clearCookie('student_session');
    return res.status(401).json({ error: 'Session expired. Please enter your passport code again.' });
  }
}

/**
 * Generate a session token for a student
 * @param studentId The student's UUID
 * @returns JWT token string
 */
export function generateStudentSession(studentId: string): string {
  const payload: StudentSessionPayload = {
    studentId
  };

  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '24h' // Session expires after 24 hours
  });
}
