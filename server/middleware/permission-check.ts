import { Request, Response, NextFunction } from 'express';

/**
 * Placeholder for permission check middleware
 * All collaborator functionality has been removed
 */
export function requirePermission(_permission: string) {
  return async (_req: Request, _res: Response, next: NextFunction) => {
    // Permission checks have been removed - using simple ownership checks instead
    next();
  };
}

// Convenience middleware for common permissions (now just pass-through)
export const requireManageStudents = requirePermission('can_manage_students');
export const requireManageStore = requirePermission('can_manage_store');
export const requireViewAnalytics = requirePermission('can_view_analytics');
export const requireExportData = requirePermission('can_export_data');
export const requireSendMessages = requirePermission('can_send_messages');
export const requireManageCurriculum = requirePermission('can_manage_curriculum');