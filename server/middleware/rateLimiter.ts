import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
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

// Game creation rate limiter - commented out as game features are removed
// export const gameCreationLimiter = rateLimit({
//   windowMs: CONFIG.RATE_LIMITS.GAME_CREATION.WINDOW_MS,
//   max: CONFIG.RATE_LIMITS.GAME_CREATION.MAX_REQUESTS,
//   message: 'Too many games created, please try again later.',
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// Rate limiter for password reset
export const passwordResetLimiter = rateLimit({
  windowMs: CONFIG.RATE_LIMITS.PASSWORD_RESET.WINDOW_MS,
  max: CONFIG.RATE_LIMITS.PASSWORD_RESET.MAX_REQUESTS,
  message: 'Too many password reset attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// WebSocket connection rate limiter - commented out as WebSocket features are removed
// export const wsConnectionLimiter = rateLimit({
//   windowMs: CONFIG.RATE_LIMITS.WS_CONNECTION.WINDOW_MS,
//   max: CONFIG.RATE_LIMITS.WS_CONNECTION.MAX_REQUESTS,
//   message: 'Too many connection attempts, please try again later.',
//   standardHeaders: true,
//   legacyHeaders: false,
// });

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
    return req.params?.passportCode || req.ip;
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
    return req.params?.passportCode || req.ip;
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