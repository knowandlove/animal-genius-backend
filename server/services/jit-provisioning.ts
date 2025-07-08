/**
 * JIT (Just-In-Time) Provisioning Service
 * 
 * Consolidates student and teacher authentication into a unified system
 * using Supabase Auth with automatic profile creation
 */

import { supabaseAdmin } from '../supabase-clients';
import { db } from '../db';
import { profiles, students, classes } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createSecureLogger } from '../utils/secure-logger';
import { v4 as uuidv4 } from 'uuid';

const logger = createSecureLogger('JITProvisioning');

export interface JITUserData {
  email?: string;
  role: 'teacher' | 'student';
  metadata: {
    // Teacher metadata
    firstName?: string;
    lastName?: string;
    schoolOrganization?: string;
    roleTitle?: string;
    
    // Student metadata
    studentId?: string;
    studentName?: string;
    classId?: string;
    passportCode?: string;
  };
}

/**
 * Create or update a user in Supabase Auth with JIT provisioning
 * This centralizes all auth into Supabase while maintaining backward compatibility
 */
export async function provisionUser(userData: JITUserData): Promise<{
  user: any;
  session: any;
  profile: any;
  isNewUser: boolean;
}> {
  try {
    logger.debug('JIT provisioning user', { role: userData.role });
    
    if (userData.role === 'teacher') {
      return await provisionTeacher(userData);
    } else {
      return await provisionStudent(userData);
    }
  } catch (error) {
    logger.error('JIT provisioning failed', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Provision a teacher account (existing flow, just organized)
 */
async function provisionTeacher(userData: JITUserData): Promise<any> {
  const { email, metadata } = userData;
  
  if (!email) {
    throw new Error('Email is required for teacher provisioning');
  }
  
  // Check if user exists in Supabase
  const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail(email);
  
  if (existingUser) {
    // User exists, ensure profile exists
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, existingUser.id))
      .limit(1);
      
    if (!profile) {
      // Create profile if missing
      const [newProfile] = await db
        .insert(profiles)
        .values({
          id: existingUser.id,
          email: email,
          firstName: metadata.firstName || '',
          lastName: metadata.lastName || '',
          schoolOrganization: metadata.schoolOrganization,
          roleTitle: metadata.roleTitle,
          isAdmin: false
        })
        .returning();
        
      return {
        user: existingUser,
        session: null, // Teacher must authenticate with password
        profile: newProfile,
        isNewUser: false
      };
    }
    
    return {
      user: existingUser,
      session: null,
      profile,
      isNewUser: false
    };
  }
  
  // This shouldn't happen for teachers - they must register first
  throw new Error('Teacher not found. Please register first.');
}

/**
 * Provision a student account using passport code
 * Creates a Supabase auth account if needed
 */
async function provisionStudent(userData: JITUserData): Promise<any> {
  const { metadata } = userData;
  
  if (!metadata.passportCode) {
    throw new Error('Passport code is required for student provisioning');
  }
  
  // Find student by passport code
  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.passportCode, metadata.passportCode))
    .limit(1);
    
  if (!student) {
    throw new Error('Invalid passport code');
  }
  
  // Check if student already has a Supabase account
  let supabaseUser;
  let isNewUser = false;
  
  // Use student UUID as the Supabase user ID for consistency
  const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(student.id);
  
  if (!existingUser) {
    // Create Supabase auth account for student
    logger.debug('Creating Supabase account for student', { studentId: student.id });
    
    // Generate a unique email for the student (not exposed to them)
    const studentEmail = `student-${student.id}@internal.animalgenius.com`;
    
    // Create user with admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: studentEmail,
      email_confirm: true, // Auto-confirm since it's internal
      user_metadata: {
        role: 'student',
        student_id: student.id,
        student_name: student.studentName,
        class_id: student.classId,
        passport_code: student.passportCode // Store for reference but don't use for auth
      }
    });
    
    if (createError) {
      logger.error('Failed to create Supabase user for student', { error: createError });
      throw new Error('Failed to create student account');
    }
    
    supabaseUser = newUser.user;
    isNewUser = true;
  } else {
    supabaseUser = existingUser;
  }
  
  // Create or update profile
  const [existingProfile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, supabaseUser.id))
    .limit(1);
    
  let profile;
  if (!existingProfile) {
    [profile] = await db
      .insert(profiles)
      .values({
        id: supabaseUser.id,
        email: supabaseUser.email!,
        firstName: student.studentName || 'Student',
        lastName: '',
        isAdmin: false,
        // Store student reference in profile metadata
        metadata: {
          role: 'student',
          studentId: student.id,
          classId: student.classId
        }
      })
      .returning();
  } else {
    profile = existingProfile;
  }
  
  // Generate session token for student
  const { data: session, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: supabaseUser.email!,
    options: {
      redirectTo: `${process.env.FRONTEND_URL}/student/dashboard`
    }
  });
  
  if (sessionError) {
    logger.error('Failed to generate session for student', { error: sessionError });
    throw new Error('Failed to create student session');
  }
  
  return {
    user: supabaseUser,
    session,
    profile,
    isNewUser,
    student // Include original student data
  };
}

/**
 * Verify if a passport code is valid and belongs to the specified class
 */
export async function verifyPassportCode(passportCode: string, classCode?: string): Promise<{
  valid: boolean;
  student?: any;
  error?: string;
}> {
  try {
    const query = db
      .select()
      .from(students)
      .where(eq(students.passportCode, passportCode));
      
    const [student] = await query.limit(1);
    
    if (!student) {
      return { valid: false, error: 'Invalid passport code' };
    }
    
    // If class code is provided, verify student belongs to that class
    if (classCode) {
      const [classData] = await db
        .select()
        .from(classes)
        .where(eq(classes.classCode, classCode.toUpperCase()))
        .limit(1);
        
      if (!classData || student.classId !== classData.id) {
        return { valid: false, error: 'Invalid passport code for this class' };
      }
    }
    
    return { valid: true, student };
  } catch (error) {
    logger.error('Error verifying passport code', { error });
    return { valid: false, error: 'Verification failed' };
  }
}

/**
 * Migrate existing student sessions to Supabase Auth
 * This allows gradual migration without breaking existing sessions
 */
export async function migrateStudentSession(studentId: string): Promise<{
  success: boolean;
  session?: any;
  error?: string;
}> {
  try {
    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);
      
    if (!student) {
      return { success: false, error: 'Student not found' };
    }
    
    // Provision the student in Supabase
    const result = await provisionStudent({
      role: 'student',
      metadata: {
        studentId: student.id,
        studentName: student.studentName,
        classId: student.classId,
        passportCode: student.passportCode
      }
    });
    
    return {
      success: true,
      session: result.session
    };
  } catch (error) {
    logger.error('Failed to migrate student session', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    };
  }
}