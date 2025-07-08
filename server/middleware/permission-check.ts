import { Request, Response, NextFunction } from 'express';
import { hasCollaboratorPermission } from '../db/collaborators';
import { CollaboratorRequest } from './collaborators';

/**
 * Create a middleware that checks for a specific permission
 */
export function requirePermission(permission: keyof import('@/shared/types/collaborators').CollaboratorPermissions) {
  return async (req: CollaboratorRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      const classId = req.params.classId || req.params.id || req.body.classId;

      if (!userId || !classId) {
        return res.status(400).json({ 
          error: 'Missing required parameters' 
        });
      }

      const hasPermission = await hasCollaboratorPermission(userId, classId, permission);
      
      if (!hasPermission) {
        return res.status(403).json({ 
          error: `You do not have permission to ${permission.replace(/_/g, ' ')}` 
        });
      }

      next();
    } catch (error) {
      console.error('Error checking permission:', error);
      res.status(500).json({ 
        error: 'Failed to verify permissions' 
      });
    }
  };
}

// Convenience middleware for common permissions
export const requireManageStudents = requirePermission('can_manage_students');
export const requireManageStore = requirePermission('can_manage_store');
export const requireViewAnalytics = requirePermission('can_view_analytics');
export const requireExportData = requirePermission('can_export_data');
export const requireSendMessages = requirePermission('can_send_messages');
export const requireManageCurriculum = requirePermission('can_manage_curriculum');