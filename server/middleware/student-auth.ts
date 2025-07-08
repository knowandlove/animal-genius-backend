import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createSecureLogger, sanitizeError } from '../utils/secure-logger';

const logger = createSecureLogger('StudentAuth');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables.");
  console.error("Server cannot start without JWT_SECRET. Please check your .env file.");
  process.exit(1);
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
  logger.debug('Student auth middleware - endpoint:', req.path);
  logger.debug('Student auth middleware - cookies present:', !!req.cookies);
  const token = req.cookies.student_session;

  if (!token) {
    logger.debug('No student_session cookie found');
    return res.status(401).json({ error: 'No session found. Please enter your passport code.' });
  }

  try {
    // JWT_SECRET is guaranteed to exist by the check at module load
    const decoded = jwt.verify(token, JWT_SECRET!);
    const payload = decoded as unknown as StudentSessionPayload;
    logger.debug('Decoded student session:', { studentId: payload.studentId });
    req.studentId = payload.studentId;
    next();
  } catch (error) {
    // Token expired or invalid
    logger.error('Token verification failed:', sanitizeError(error));
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

  // JWT_SECRET is guaranteed to exist by the check at module load
  return jwt.sign(payload, JWT_SECRET!, {
    expiresIn: '24h' // Session expires after 24 hours
  });
}
