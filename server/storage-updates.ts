// Storage interface updates for Supabase Auth integration
// This file contains the key method signatures that need to be updated

import { Profile, Class, QuizSubmission, Student, CurrencyTransaction, AdminLog } from "@shared/schema";

// Updated types with UUID support
export interface ProfileData {
  id: string; // UUID
  firstName: string;
  lastName: string;
  email: string;
  schoolOrganization: string;
  roleTitle?: string | null;
  howHeardAbout?: string | null;
  personalityAnimal?: string | null;
  isAdmin: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
}

// Key storage methods that need updating for UUID support
export interface IStorageUpdates {
  // Profile methods (replaces user methods)
  getProfileById(id: string): Promise<ProfileData | null>;
  getProfileByEmail(email: string): Promise<ProfileData | null>;
  updateProfile(id: string, data: Partial<ProfileData>): Promise<ProfileData>;
  updateLastLogin(id: string): Promise<void>;
  
  // Class methods with UUID teacherId
  createClass(data: { name: string; teacherId: string; iconEmoji?: string; iconColor?: string }): Promise<Class>;
  getClassesByTeacherId(teacherId: string): Promise<Class[]>;
  
  // Transaction methods with UUID teacherId
  giveCurrencyWithTransaction(
    studentId: string,
    amount: number,
    teacherId: string,
    reason: string
  ): Promise<{ newBalance: number }>;
  
  takeCurrencyWithTransaction(
    studentId: string,
    amount: number,
    teacherId: string,
    reason: string
  ): Promise<{ newBalance: number; actualAmount: number }>;
  
  // Admin methods with UUID adminId
  logAdminAction(data: {
    adminId: string;
    action: string;
    targetUserId?: string | null;
    targetClassId?: number | null;
    targetSubmissionId?: number | null;
    details?: any;
  }): Promise<void>;
  
  // Lesson progress with UUID teacherId
  markLessonComplete(teacherId: string, classId: number, lessonId: number): Promise<any>;
  isLessonComplete(teacherId: string, classId: number, lessonId: number): Promise<boolean>;
}

// Migration helper methods
export interface IMigrationHelpers {
  // Create mapping between old numeric IDs and new UUIDs
  createUserIdMapping(oldId: number, newUuid: string): Promise<void>;
  getUserIdMapping(oldId: number): Promise<string | null>;
  
  // Batch update foreign keys
  updateClassTeacherIds(): Promise<number>;
  updateTransactionTeacherIds(): Promise<number>;
  updateAdminLogUserIds(): Promise<number>;
  updateLessonProgressTeacherIds(): Promise<number>;
  updatePurchaseRequestProcessedBy(): Promise<number>;
}
