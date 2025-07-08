import { Request, Response, NextFunction } from 'express';
import { hasClassAccess, canEditClass, getClassRole } from '../db/collaborators';

export interface CollaboratorRequest extends Request {
  userRole?: 'owner' | 'viewer' | 'editor' | null;
  hasEditAccess?: boolean;
}

/**
 * Middleware to check if user has any access to a class
 */
export async function requireClassAccess(
  req: CollaboratorRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.userId;
    const classId = req.params.classId || req.body.classId;

    if (!userId || !classId) {
      return res.status(400).json({ 
        error: 'Missing required parameters' 
      });
    }

    const hasAccess = await hasClassAccess(userId, classId);
    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'You do not have access to this class' 
      });
    }

    // Add role information to request for later use
    req.userRole = await getClassRole(userId, classId);

    next();
  } catch (error) {
    console.error('Error checking class access:', error);
    res.status(500).json({ 
      error: 'Failed to verify class access' 
    });
  }
}

/**
 * Middleware to check if user can edit a class
 */
export async function requireClassEditAccess(
  req: CollaboratorRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.userId;
    const classId = req.params.classId || req.body.classId;

    if (!userId || !classId) {
      return res.status(400).json({ 
        error: 'Missing required parameters' 
      });
    }

    const canEdit = await canEditClass(userId, classId);
    if (!canEdit) {
      return res.status(403).json({ 
        error: 'You do not have permission to edit this class' 
      });
    }

    req.hasEditAccess = true;
    req.userRole = await getClassRole(userId, classId);

    next();
  } catch (error) {
    console.error('Error checking edit access:', error);
    res.status(500).json({ 
      error: 'Failed to verify edit access' 
    });
  }
}

/**
 * Middleware to check if user is the class owner
 */
export async function requireClassOwner(
  req: CollaboratorRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.userId;
    const classId = req.params.classId || req.body.classId;

    if (!userId || !classId) {
      return res.status(400).json({ 
        error: 'Missing required parameters' 
      });
    }

    const role = await getClassRole(userId, classId);
    if (role !== 'owner') {
      return res.status(403).json({ 
        error: 'Only the class owner can perform this action' 
      });
    }

    req.userRole = role;

    next();
  } catch (error) {
    console.error('Error checking owner access:', error);
    res.status(500).json({ 
      error: 'Failed to verify owner access' 
    });
  }
}