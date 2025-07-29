import type { Request, Response, NextFunction } from 'express';

// Track active sessions per user
const activeSessions = new Map<string, Set<string>>();
const MAX_CONCURRENT_SESSIONS = 3; // Allow up to 3 concurrent sessions per teacher

/**
 * Generate a session ID from request headers
 */
function generateSessionId(req: Request): string {
  const userAgent = req.headers['user-agent'] || 'unknown';
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  // Create a simple session identifier
  return Buffer.from(`${userAgent}-${ip}-${Date.now()}`).toString('base64').slice(0, 32);
}

/**
 * Track session for user
 */
export function trackSession(userId: string, sessionId: string): void {
  if (!activeSessions.has(userId)) {
    activeSessions.set(userId, new Set());
  }
  
  const userSessions = activeSessions.get(userId)!;
  userSessions.add(sessionId);
  
  // Clean up old sessions if exceeded limit
  if (userSessions.size > MAX_CONCURRENT_SESSIONS) {
    // Remove oldest sessions (simple FIFO)
    const sessions = Array.from(userSessions);
    const toRemove = sessions.slice(0, sessions.length - MAX_CONCURRENT_SESSIONS);
    toRemove.forEach(session => userSessions.delete(session));
  }
}

/**
 * Remove session for user
 */
export function removeSession(userId: string, sessionId: string): void {
  const userSessions = activeSessions.get(userId);
  if (userSessions) {
    userSessions.delete(sessionId);
    if (userSessions.size === 0) {
      activeSessions.delete(userId);
    }
  }
}

/**
 * Check if session is valid
 */
export function isSessionValid(userId: string, sessionId: string): boolean {
  const userSessions = activeSessions.get(userId);
  return userSessions ? userSessions.has(sessionId) : false;
}

/**
 * Get session count for user
 */
export function getSessionCount(userId: string): number {
  const userSessions = activeSessions.get(userId);
  return userSessions ? userSessions.size : 0;
}

/**
 * Middleware to track concurrent sessions
 */
export function sessionTracker(req: Request, res: Response, next: NextFunction) {
  // Only track sessions for authenticated users
  if (req.user?.userId) {
    const sessionId = generateSessionId(req);
    trackSession(req.user.userId, sessionId);
    
    // Store session ID on request for cleanup on logout
    req.sessionId = sessionId;
    
    // Add session count to response headers (for debugging)
    if (process.env.NODE_ENV === 'development') {
      res.setHeader('X-Session-Count', getSessionCount(req.user.userId));
    }
  }
  
  next();
}

/**
 * Clear all sessions (for admin/debugging)
 */
export function clearAllSessions(): void {
  activeSessions.clear();
}

// Extend Request type
declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
    }
  }
}