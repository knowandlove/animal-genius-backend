import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables.");
  process.exit(1);
}

export interface StudentSessionPayload {
  submissionId: number;
  // No personal data - just the reference ID
}

declare global {
  namespace Express {
    interface Request {
      studentSubmissionId?: number;
    }
  }
}

/**
 * Middleware to verify student session tokens
 * Used for all /api/island/me/* endpoints
 */
export function requireStudentSession(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.student_session;

  if (!token) {
    return res.status(401).json({ error: 'No session found. Please enter your passport code.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as StudentSessionPayload;
    req.studentSubmissionId = payload.submissionId;
    next();
  } catch (error) {
    // Token expired or invalid
    res.clearCookie('student_session');
    return res.status(401).json({ error: 'Session expired. Please enter your passport code again.' });
  }
}

/**
 * Generate a session token for a student
 * @param submissionId The quiz submission ID
 * @returns JWT token string
 */
export function generateStudentSession(submissionId: number): string {
  const payload: StudentSessionPayload = {
    submissionId
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '24h' // Session expires after 24 hours
  });
}
