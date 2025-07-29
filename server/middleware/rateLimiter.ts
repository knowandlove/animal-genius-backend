import rateLimit from 'express-rate-limit';
import { CONFIG } from '../config/constants';

// General rate limiter for all API endpoints
export const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || String(CONFIG.RATE_LIMITS.API.WINDOW_MS)),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || String(CONFIG.RATE_LIMITS.API.MAX_REQUESTS)),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: CONFIG.RATE_LIMITS.AUTH.WINDOW_MS,
  max: CONFIG.RATE_LIMITS.AUTH.MAX_REQUESTS,
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: CONFIG.RATE_LIMITS.AUTH.SKIP_SUCCESSFUL,
});

// Rate limiter for password reset
export const passwordResetLimiter = rateLimit({
  windowMs: CONFIG.RATE_LIMITS.PASSWORD_RESET.WINDOW_MS,
  max: CONFIG.RATE_LIMITS.PASSWORD_RESET.MAX_REQUESTS,
  message: 'Too many password reset attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Store purchase rate limiter (per student)
export const storePurchaseLimiter = rateLimit({
  windowMs: CONFIG.RATE_LIMITS.STORE_PURCHASE.WINDOW_MS,
  max: CONFIG.RATE_LIMITS.STORE_PURCHASE.MAX_REQUESTS,
  message: 'Too many purchase attempts. Please wait before trying again.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by passport code (student) if available, otherwise IP
    return req.body?.passportCode || req.ip;
  },
});

// Store browsing rate limiter (less strict)
export const storeBrowsingLimiter = rateLimit({
  windowMs: CONFIG.RATE_LIMITS.STORE_BROWSING.WINDOW_MS,
  max: CONFIG.RATE_LIMITS.STORE_BROWSING.MAX_REQUESTS,
  message: 'Too many store requests. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Prefer passport code for per-student limiting
    return req.headers['x-passport-code'] as string || 
           req.params?.passportCode || 
           req.body?.passportCode || 
           req.ip;
  },
});

// Room save operations rate limiter
export const roomSaveLimiter = rateLimit({
  windowMs: CONFIG.RATE_LIMITS.ROOM_SAVE.WINDOW_MS,
  max: CONFIG.RATE_LIMITS.ROOM_SAVE.MAX_REQUESTS,
  message: 'Too many room save attempts. Please wait before saving again.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by passport code (student) if available, otherwise IP
    return req.params?.passportCode || req.ip || 'unknown';
  },
});

// Room data browsing rate limiter
export const roomBrowsingLimiter = rateLimit({
  windowMs: CONFIG.RATE_LIMITS.ROOM_BROWSING.WINDOW_MS,
  max: CONFIG.RATE_LIMITS.ROOM_BROWSING.MAX_REQUESTS,
  message: 'Too many room requests. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Prefer passport code for per-student limiting
    return req.headers['x-passport-code'] as string || 
           req.params?.passportCode || 
           req.body?.passportCode || 
           req.ip || 
           'unknown';
  },
});

// Passport code login rate limiter (protect against brute force)
export const passportLoginLimiter = rateLimit({
  windowMs: CONFIG.RATE_LIMITS.PASSPORT_LOGIN.WINDOW_MS,
  max: CONFIG.RATE_LIMITS.PASSPORT_LOGIN.MAX_REQUESTS,
  message: 'Too many login attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});