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
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Direct console logging to bypass redaction
    console.error('🚨 JIT PROVISIONING ERROR DETAILS:');
    console.error('Error message:', errorMessage);
    console.error('Error stack:', errorStack);
    console.error('User data:', JSON.stringify(userData, null, 2));
    
    logger.error('JIT provisioning failed', { 
      error: errorMessage,
      stack: errorStack,
      role: userData.role,
      metadata: userData.metadata 
    });
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
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const existingUser = users?.users?.find(u => u.email === email) || null;
  
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
 * DEPRECATED: Students should use passport code authentication instead
 */
async function provisionStudent(userData: JITUserData): Promise<any> {
  throw new Error('Student provisioning disabled. Students should use passport code authentication via Edge Functions.');
  const { metadata } = userData;
  
  if (!metadata.passportCode) {
    throw new Error('Passport code is required for student provisioning');
  }
  
  // Find student by passport code
  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.passportCode, metadata.passportCode!))
    .limit(1);
    
  if (!student) {
    throw new Error('Invalid passport code');
  }
  
  // Check if student already has a Supabase account
  let supabaseUser;
  let isNewUser = false;
  
  // Generate the email that would be used for this student
  const studentEmail = `student-${student.id}@internal.animalgenius.com`;
  
  console.log('🔍 Checking for existing Supabase user by email:', studentEmail);
  console.log('🔍 Student details:', { 
    id: student.id, 
    name: student.studentName, 
    passportCode: student.passportCode 
  });
  
  // Check by email instead of ID since Supabase generates its own UUIDs
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const existingUser = users?.users?.find(u => u.email === studentEmail) || null;
  console.log('🔍 Existing user result:', existingUser);
  
  if (!existingUser) {
    // Create Supabase auth account for student
    logger.debug('Creating Supabase account for student', { studentId: student.id });
    console.log('🔧 Creating new Supabase user with email:', studentEmail);
    
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
    
    console.log('🔧 Supabase user creation response:', JSON.stringify({ newUser, createError }, null, 2));
    
    if (createError) {
      console.error('🚨 Supabase user creation error:', createError);
      logger.error('Failed to create Supabase user for student', { error: createError });
      throw new Error('Failed to create student account');
    }
    
    if (!newUser?.user?.id) {
      console.error('🚨 Supabase user creation returned invalid user:', JSON.stringify(newUser, null, 2));
      throw new Error('Supabase user creation failed - no user ID returned');
    }
    
    supabaseUser = newUser.user;
    isNewUser = true;
  } else {
    supabaseUser = existingUser;
  }
  
  // Create or update profile
  if (!supabaseUser?.id) {
    console.error('🚨 No Supabase user ID available for profile creation:', supabaseUser);
    throw new Error('Invalid Supabase user - missing ID');
  }
  
  const [existingProfile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, supabaseUser.id))
    .limit(1);
    
  let profile;
  if (!existingProfile) {
    console.log('🔧 Creating profile for student:', { 
      userId: supabaseUser.id, 
      email: supabaseUser.email,
      studentName: student.studentName 
    });
    
    [profile] = await db
      .insert(profiles)
      .values({
        id: supabaseUser.id,
        email: supabaseUser.email!,
        firstName: student.studentName || 'Student',
        lastName: '',
        isAdmin: false,
        isAnonymous: true // Mark as anonymous since it's a student account
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
 * DEPRECATED: Students will use Custom JWT Authorizer pattern instead
 * This function is temporarily disabled pending Phase 1 implementation
 */
export async function migrateStudentSession(studentId: string): Promise<{
  success: boolean;
  session?: any;
  error?: string;
}> {
  // Migration disabled - students will use Custom JWT Authorizer pattern
  return { success: false, error: 'Migration disabled. Use Custom JWT Authorizer pattern.' };
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
        studentName: student.studentName || 'Unknown Student',
        classId: student.classId,
        passportCode: student.passportCode
      }
    });
    
    return {
      success: true,
      session: result.session
    };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Migration failed';
    logger.error('Failed to migrate student session', { error });
    return {
      success: false,
      error: errorMessage
    };
  }
}