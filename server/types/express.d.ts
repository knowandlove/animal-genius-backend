import { Request } from 'express';
import { Profile } from '@shared/schema';

/**
 * Base request with common properties added by our middleware
 */
export interface AppRequest extends Request {
  id: string; // Request ID from requestIdMiddleware
}

/**
 * Request type for authenticated teacher/admin routes
 */
export interface AuthenticatedRequest extends AppRequest {
  user: {
    userId: string; // UUID
    email: string;
    isAdmin: boolean;
  };
  profile?: Profile; // Optional profile data
}

/**
 * Request type for student authenticated routes (legacy)
 */
export interface StudentAuthenticatedRequest extends AppRequest {
  studentId: string; // UUID
  classId?: string; // UUID - from JWT session if available
}

/**
 * Request type for passport-authenticated student routes
 */
export interface PassportAuthenticatedRequest extends AppRequest {
  student: {
    id: string;
    name: string;
    classId: string;
    schoolYear: string;
    animalType: string;
    geniusType: string;
    passportCode: string;
    userId: string;
  };
}

/**
 * Request type for room access
 */
export interface RoomAccessRequest extends Request {
  studentId?: string; // UUID
  user?: {
    userId: string;
    email: string;
    isAdmin: boolean;
  };
  profile?: Profile;
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