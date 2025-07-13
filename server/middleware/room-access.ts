import type { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { students, quizSubmissions, profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { supabaseAdmin } from '../supabase-clients';
import { getCachedProfile } from './profile-cache';
// JWT imports removed - using unified auth

/**
 * Comprehensive room access control
 * Handles both teacher and student access based on room visibility settings
 */
export async function checkRoomAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const passportCode = req.params.passportCode;
    if (!passportCode) {
      return res.status(400).json({ message: 'Passport code required' });
    }

    // Get the room owner's info
    const [roomOwner] = await db
      .select({
        id: students.id,
        classId: students.classId,
        roomVisibility: students.roomVisibility,
        studentName: students.studentName
      })
      .from(students)
      .where(eq(students.passportCode, passportCode))
      .limit(1);

    if (!roomOwner) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Legacy cookie handling removed - unified auth middleware handles this

    // Check 0: Try to authenticate teacher from Authorization header
    const authHeader = req.headers.authorization;
    console.log('Room access - checking auth header:', !!authHeader);
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      console.log('Room access - extracted token:', token?.substring(0, 20) + '...');
      if (token) {
        try {
          // Verify teacher token with Supabase Admin client for security
          const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
          console.log('Room access - Supabase auth result:', { userId: user?.id, error: error?.message });
          if (user && !error) {
            // Get teacher profile
            const profile = await getCachedProfile(user.id);
            console.log('Room access - teacher profile found:', !!profile);
            if (profile) {
              // Teacher or admin - always allow access
              req.user = {
                userId: user.id,
                email: user.email || '',
                isAdmin: profile.isAdmin || false
              };
              req.profile = profile;
              req.roomAccess = {
                canView: true,
                canEdit: true,
                isOwner: false,
                isTeacher: true,
                roomOwner
              };
              console.log('Room access - teacher authenticated successfully');
              return next();
            }
          }
        } catch (error) {
          // Token verification failed, continue to student auth
          console.log('Teacher auth check failed:', error);
        }
      }
    }

    // Check 1: Teacher/Admin Override (if already authenticated by other middleware)
    if (req.user?.isAdmin || req.user?.userId) {
      // Teacher or admin - always allow access
      req.roomAccess = {
        canView: true,
        canEdit: true,
        isOwner: false,
        isTeacher: true,
        roomOwner
      };
      return next();
    }

    // Check 2: Student Authentication
    if (req.student?.id) {
      // Get the authenticated student's info
      console.log('Looking up student with ID:', req.student.id);
      
      // Get the student details
      const [authStudent] = await db
        .select({
          passportCode: students.passportCode,
          classId: students.classId
        })
        .from(students)
        .where(eq(students.id, req.student.id))
        .limit(1);

      if (!authStudent) {
        return res.status(401).json({ message: 'Invalid session' });
      }

      // Check 3: Is this the owner?
      if (authStudent.passportCode === passportCode) {
        req.roomAccess = {
          canView: true,
          canEdit: true,
          isOwner: true,
          isTeacher: false,
          roomOwner
        };
        return next();
      }

      // Check 4: Room visibility settings
      const visibility = roomOwner.roomVisibility || 'class'; // Default to 'class' for backwards compatibility

      switch (visibility) {
        case 'class':
          // Check if student is in the same class
          if (authStudent.classId === roomOwner.classId) {
            req.roomAccess = {
              canView: true,
              canEdit: false,
              isOwner: false,
              isTeacher: false,
              roomOwner
            };
            return next();
          }
          break;
        
        case 'private':
          // Only owner can view
          return res.status(403).json({ 
            message: 'This room is private',
            roomVisibility: 'private'
          });
        
        case 'invite_only':
          // TODO: Check invitation table in Phase 3
          return res.status(403).json({ 
            message: 'This room requires an invitation',
            roomVisibility: 'invite_only'
          });
      }

      // Different class or no access
      return res.status(403).json({ 
        message: 'You cannot view rooms from other classes',
        roomVisibility: visibility
      });
    }

    // No authentication at all
    return res.status(401).json({ 
      message: 'Please log in to view this room',
      requiresAuth: true
    });

  } catch (error) {
    console.error('Room access check error:', error);
    return res.status(500).json({ message: 'Failed to check room access' });
  }
}

/**
 * Middleware to allow public room viewing (read-only)
 * Used for the future public room directory
 */
export async function publicRoomAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const passportCode = req.params.passportCode;
    if (!passportCode) {
      return res.status(400).json({ message: 'Passport code required' });
    }

    const [roomOwner] = await db
      .select({
        id: students.id,
        roomVisibility: students.roomVisibility,
        studentName: students.studentName,
        classId: students.classId
      })
      .from(students)
      .where(eq(students.passportCode, passportCode))
      .limit(1);

    if (!roomOwner) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // For public endpoints, we still check visibility but don't require auth
    const visibility = roomOwner.roomVisibility || 'class';
    
    if (visibility === 'private') {
      return res.status(403).json({ 
        message: 'This room is private',
        canView: false
      });
    }

    req.roomAccess = {
      canView: true,
      canEdit: false,
      isOwner: false,
      isTeacher: false,
      roomOwner
    };

    next();
  } catch (error) {
    console.error('Public room access error:', error);
    return res.status(500).json({ message: 'Failed to check room access' });
  }
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      roomAccess?: {
        canView: boolean;
        canEdit: boolean;
        isOwner: boolean;
        isTeacher: boolean;
        roomOwner: {
          id: string;
          classId: string;
          roomVisibility?: string | null;
          studentName: string | null;
        };
      };
    }
  }
}