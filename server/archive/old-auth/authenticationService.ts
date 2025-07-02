import { db } from '../db';
import { 
  activations, 
  classroomSessions, 
  students, 
  classes,
  Activation,
  ClassroomSession,
  Student,
  Class
} from '@shared/schema';
import { eq, and, gt, lt, sql } from 'drizzle-orm';
import { 
  generateUniqueFunCode, 
  generateActivationCode, 
  generateSessionCode,
  isValidSessionCode,
  isValidActivationCode
} from '../lib/auth/funCodeGenerator';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export class AuthenticationService {
  /**
   * Creates a new classroom session for teacher
   */
  static async createClassroomSession(classId: string, teacherId: string): Promise<ClassroomSession> {
    // Verify class is paid for
    const classData = await db.query.classes.findFirst({
      where: eq(classes.id, classId)
    });

    if (!classData?.isPaid) {
      throw new Error('Class must be paid for before starting sessions');
    }

    // Deactivate any existing sessions for this class
    await db.update(classroomSessions)
      .set({ isActive: false })
      .where(eq(classroomSessions.classId, classId));

    // Generate new session code
    const sessionCode = generateSessionCode();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 12); // 12 hour expiry

    // Create new session
    const [session] = await db.insert(classroomSessions).values({
      classId,
      sessionCode,
      isActive: true,
      expiresAt,
      createdBy: teacherId
    }).returning();

    return session;
  }

  /**
   * Validates a classroom session code
   */
  static async validateSessionCode(sessionCode: string): Promise<{ valid: boolean; classId?: string; className?: string }> {
    if (!isValidSessionCode(sessionCode)) {
      return { valid: false };
    }

    const session = await db.query.classroomSessions.findFirst({
      where: and(
        eq(classroomSessions.sessionCode, sessionCode),
        eq(classroomSessions.isActive, true),
        gt(classroomSessions.expiresAt, new Date())
      ),
      with: {
        class: true
      }
    });

    if (!session) {
      return { valid: false };
    }

    return { 
      valid: true, 
      classId: session.classId,
      className: session.class.name
    };
  }

  /**
   * Gets students for visual picker
   */
  static async getClassStudents(classId: string): Promise<Array<{ id: string; funCode: string; avatarId: string; studentName: string }>> {
    const classStudents = await db.query.students.findMany({
      where: eq(students.classId, classId),
      columns: {
        id: true,
        funCode: true,
        avatarId: true,
        studentName: true
      }
    });

    return classStudents.filter(s => s.funCode && s.avatarId) as Array<{ 
      id: string; 
      funCode: string; 
      avatarId: string; 
      studentName: string 
    }>;
  }

  /**
   * Generates activation codes for a paid class
   * Teacher has already paid, so we just generate codes for students to join
   */
  static async generateClassActivations(classId: string, count: number): Promise<Activation[]> {
    // Verify class is paid and has capacity
    const classData = await db.query.classes.findFirst({
      where: eq(classes.id, classId)
    });

    if (!classData?.isPaid) {
      throw new Error('Class must be paid for before generating activations');
    }

    // Count existing students and activations
    const existingStudents = await db.query.students.findMany({
      where: eq(students.classId, classId)
    });

    const existingActivations = await db.query.activations.findMany({
      where: and(
        eq(activations.classId, classId),
        eq(activations.isActivated, false),
        gt(activations.expiresAt, new Date())
      )
    });

    const totalSlots = existingStudents.length + existingActivations.length + count;
    
    if (totalSlots > (classData.paidStudentCount || classData.maxStudents || 50)) {
      throw new Error(`Cannot generate ${count} more activations. Would exceed paid capacity.`);
    }

    // Generate activation codes
    const newActivations: Activation[] = [];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90); // 90 day expiry

    for (let i = 0; i < count; i++) {
      const activationCode = generateActivationCode();
      const [activation] = await db.insert(activations).values({
        classId,
        activationCode,
        expiresAt
      }).returning();
      newActivations.push(activation);
    }

    return newActivations;
  }

  /**
   * Activates a student account with an activation code
   */
  static async activateStudent(
    activationCode: string, 
    studentName: string, 
    avatarId: string
  ): Promise<{ success: boolean; student?: Student; error?: string }> {
    if (!isValidActivationCode(activationCode)) {
      return { success: false, error: 'Invalid activation code format' };
    }

    // Find the activation
    const activation = await db.query.activations.findFirst({
      where: and(
        eq(activations.activationCode, activationCode),
        eq(activations.isActivated, false),
        gt(activations.expiresAt, new Date())
      ),
      with: {
        class: true
      }
    });

    if (!activation) {
      return { success: false, error: 'Invalid or expired activation code' };
    }

    // Verify class is still paid
    if (!activation.class.isPaid) {
      return { success: false, error: 'Class access has expired' };
    }

    // Generate unique fun code
    const funCode = await generateUniqueFunCode();

    // Create the student
    const [student] = await db.insert(students).values({
      classId: activation.classId,
      funCode,
      avatarId,
      studentName,
      activationId: activation.id,
      passportCode: `TEMP-${Date.now()}` // Temporary until we remove this column
    }).returning();

    // Mark activation as used
    await db.update(activations)
      .set({ 
        isActivated: true, 
        activatedAt: new Date(),
        activatedByStudentId: student.id
      })
      .where(eq(activations.id, activation.id));

    return { success: true, student };
  }

  /**
   * Student login via visual picker
   */
  static async studentLogin(funCode: string, avatarId: string): Promise<{ success: boolean; token?: string; student?: Student; error?: string }> {
    const student = await db.query.students.findFirst({
      where: and(
        eq(students.funCode, funCode),
        eq(students.avatarId, avatarId)
      ),
      with: {
        class: true
      }
    });

    if (!student) {
      return { success: false, error: 'Invalid login' };
    }

    // Verify class is still paid
    if (!student.class.isPaid) {
      return { success: false, error: 'Class access has expired' };
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        studentId: student.id,
        classId: student.classId,
        funCode: student.funCode
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return { success: true, token, student };
  }

  /**
   * Get class activation summary
   */
  static async getClassActivationSummary(classId: string): Promise<{
    totalPaid: number;
    studentsCreated: number;
    pendingActivations: number;
    availableSlots: number;
  }> {
    const classData = await db.query.classes.findFirst({
      where: eq(classes.id, classId)
    });

    if (!classData) {
      throw new Error('Class not found');
    }

    const students = await db.query.students.findMany({
      where: eq(students.classId, classId)
    });

    const pendingActivations = await db.query.activations.findMany({
      where: and(
        eq(activations.classId, classId),
        eq(activations.isActivated, false),
        gt(activations.expiresAt, new Date())
      )
    });

    const totalPaid = classData.paidStudentCount || classData.maxStudents || 0;
    const studentsCreated = students.length;
    const pendingCount = pendingActivations.length;
    const availableSlots = totalPaid - studentsCreated - pendingCount;

    return {
      totalPaid,
      studentsCreated,
      pendingActivations: pendingCount,
      availableSlots: Math.max(0, availableSlots)
    };
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): { valid: boolean; payload?: any } {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      return { valid: true, payload };
    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * Get student by token
   */
  static async getStudentByToken(token: string): Promise<Student | null> {
    const { valid, payload } = this.verifyToken(token);
    
    if (!valid || !payload.studentId) {
      return null;
    }

    const student = await db.query.students.findFirst({
      where: eq(students.id, payload.studentId)
    });

    return student || null;
  }
}

// Export individual functions for convenience
export const {
  createClassroomSession,
  validateSessionCode,
  getClassStudents,
  generateClassActivations,
  activateStudent,
  studentLogin,
  getClassActivationSummary,
  verifyToken,
  getStudentByToken
} = AuthenticationService;