import { Router } from 'express';
import { uuidStorage } from '../storage-uuid';
import { requireAuth } from '../middleware/auth';
import { verifyClassEditAccess } from '../middleware/ownership-collaborator';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../types/api';

const router = Router();

// Update class settings schema
const updateClassSettingsSchema = z.object({
  name: z.string().min(1, "Class name is required").optional(),
  subject: z.string().nullable().optional(),
  gradeLevel: z.string().nullable().optional(),
  schoolName: z.string().nullable().optional(),
  icon: z.string().optional(),
  backgroundColor: z.string().optional(),
  numberOfStudents: z.number().nullable().optional(),
});

// Get class settings
router.get('/:id/settings', requireAuth, verifyClassEditAccess, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const classId = authReq.params.id;
    
    // Get class details
    const classRecord = await uuidStorage.getClassById(classId);
    
    if (!classRecord) {
      return res.status(404).json({ message: "Class not found" });
    }
    
    // Return settings-relevant fields
    res.json({
      id: classRecord.id,
      name: classRecord.name,
      subject: classRecord.subject,
      gradeLevel: classRecord.gradeLevel,
      schoolName: classRecord.schoolName,
      icon: classRecord.icon,
      backgroundColor: classRecord.backgroundColor,
      numberOfStudents: classRecord.numberOfStudents,
      classCode: classRecord.classCode,
      isArchived: classRecord.isArchived,
    });
  } catch (error) {
    console.error("Get class settings error:", error);
    res.status(500).json({ message: "Failed to get class settings" });
  }
});

// Update class settings
router.put('/:id/settings', requireAuth, verifyClassEditAccess, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const classId = authReq.params.id;
    
    // Validate request body
    const validatedData = updateClassSettingsSchema.parse(authReq.body);
    
    // Update class settings
    const updatedClass = await uuidStorage.updateClass(classId, validatedData);
    
    if (!updatedClass) {
      return res.status(404).json({ message: "Class not found" });
    }
    
    res.json({
      message: "Class settings updated successfully",
      class: updatedClass,
    });
  } catch (error) {
    console.error("Update class settings error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Invalid settings data", 
        errors: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    res.status(500).json({ message: "Failed to update class settings" });
  }
});

// Archive/Unarchive class
router.post('/:id/archive', requireAuth, verifyClassEditAccess, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const classId = authReq.params.id;
    const { isArchived } = req.body;
    
    // Update archive status
    const updatedClass = await uuidStorage.updateClass(classId, { 
      isArchived: !!isArchived 
    });
    
    if (!updatedClass) {
      return res.status(404).json({ message: "Class not found" });
    }
    
    res.json({
      message: `Class ${isArchived ? 'archived' : 'unarchived'} successfully`,
      class: updatedClass,
    });
  } catch (error) {
    console.error("Archive class error:", error);
    res.status(500).json({ message: "Failed to archive class" });
  }
});

export default router;
