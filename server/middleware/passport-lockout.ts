import type { Request, Response, NextFunction } from 'express';

// Track failed attempts per passport code
const failedAttempts = new Map<string, {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
  lockedUntil?: number;
}>();

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

/**
 * Track failed authentication attempt
 */
export function trackFailedAttempt(passportCode: string): boolean {
  const now = Date.now();
  const attempts = failedAttempts.get(passportCode);
  
  if (attempts) {
    // Check if locked out
    if (attempts.lockedUntil && attempts.lockedUntil > now) {
      return true; // Still locked out
    }
    
    // Reset if outside window
    if (now - attempts.firstAttempt > ATTEMPT_WINDOW) {
      failedAttempts.set(passportCode, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now
      });
      return false;
    }
    
    // Increment attempts
    attempts.count++;
    attempts.lastAttempt = now;
    
    // Check if should lock out
    if (attempts.count >= MAX_ATTEMPTS) {
      attempts.lockedUntil = now + LOCKOUT_DURATION;
      console.warn(`🔒 Passport code ${passportCode} locked out after ${attempts.count} failed attempts`);
      return true;
    }
  } else {
    // First failed attempt
    failedAttempts.set(passportCode, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now
    });
  }
  
  return false;
}

/**
 * Check if passport code is locked out
 */
export function isLockedOut(passportCode: string): boolean {
  const now = Date.now();
  const attempts = failedAttempts.get(passportCode);
  
  if (!attempts) {
    return false;
  }
  
  if (attempts.lockedUntil && attempts.lockedUntil > now) {
    return true;
  }
  
  return false;
}

/**
 * Clear failed attempts on successful login
 */
export function clearFailedAttempts(passportCode: string): void {
  failedAttempts.delete(passportCode);
}

/**
 * Get lockout status
 */
export function getLockoutStatus(passportCode: string) {
  const attempts = failedAttempts.get(passportCode);
  const now = Date.now();
  
  if (!attempts) {
    return {
      isLocked: false,
      attemptsRemaining: MAX_ATTEMPTS
    };
  }
  
  if (attempts.lockedUntil && attempts.lockedUntil > now) {
    return {
      isLocked: true,
      lockedUntil: attempts.lockedUntil,
      minutesRemaining: Math.ceil((attempts.lockedUntil - now) / 60000)
    };
  }
  
  return {
    isLocked: false,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - attempts.count),
    failedAttempts: attempts.count
  };
}

/**
 * Middleware to check passport code lockout
 */
export function checkPassportLockout(req: Request, res: Response, next: NextFunction) {
  const passportCode = req.body.passportCode || req.params.passportCode;
  
  if (!passportCode) {
    return next();
  }
  
  if (isLockedOut(passportCode)) {
    const status = getLockoutStatus(passportCode);
    return res.status(429).json({
      message: `This passport code is temporarily locked due to too many failed attempts. Please try again in ${status.minutesRemaining} minutes.`,
      lockedUntil: status.lockedUntil,
      minutesRemaining: status.minutesRemaining
    });
  }
  
  next();
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  const cutoff = now - ATTEMPT_WINDOW;
  
  for (const [passportCode, attempts] of failedAttempts.entries()) {
    // Remove if lockout expired and no recent attempts
    if (attempts.lastAttempt < cutoff && (!attempts.lockedUntil || attempts.lockedUntil < now)) {
      failedAttempts.delete(passportCode);
    }
  }
}, CLEANUP_INTERVAL);

// Log statistics periodically in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    if (failedAttempts.size > 0) {
      console.log(`📊 Passport lockout status: ${failedAttempts.size} codes being tracked`);
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}