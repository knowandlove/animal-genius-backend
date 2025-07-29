import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest, StudentAuthenticatedRequest } from '../types/api';
import { requireAuth as baseRequireAuth, requireAdmin as baseRequireAdmin, optionalAuth as baseOptionalAuth } from './auth';
import { requireUnifiedAuth, requireStudent } from './unified-auth';

/**
 * Type-safe authentication middleware that ensures req.user exists
 */
export const requireAuth = baseRequireAuth as unknown as (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => Promise<void>;

/**
 * Type-safe admin middleware that ensures req.user exists and is admin
 */
export const requireAdmin = baseRequireAdmin as unknown as (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => Promise<void>;

/**
 * Type-safe optional auth middleware
 */
export const optionalAuth = baseOptionalAuth as unknown as (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

/**
 * Type-safe student authentication middleware
 */
export const requireStudentAuth = ((req: StudentAuthenticatedRequest, res: Response, _next: NextFunction) => {
  return requireUnifiedAuth(req, res, () => requireStudent(req, res, next));
}) as unknown as (
  req: StudentAuthenticatedRequest,
  res: Response,
  next: NextFunction
) => Promise<void>;