import { Request, Response, NextFunction } from 'express';
import { uuidStorage } from '../storage-uuid';

// Simple middleware to validate class exists and is active
export async function validateClassAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const classId = req.body.classId || req.params.classId;
    
    if (!classId) {
      return res.status(400).json({ message: 'Class ID is required' });
    }
    
    // Check if class exists
    const classData = await uuidStorage.getClassById(classId);
    
    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    // Check if class is archived
    if (classData.isArchived) {
      return res.status(403).json({ message: 'This class is no longer active' });
    }
    
    // Add class data to request for downstream use
    (req as any).classData = classData;
    
    next();
  } catch (error) {
    console.error('Class validation error:', error);
    res.status(500).json({ message: 'Failed to validate class access' });
  }
}