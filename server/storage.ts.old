import { 
  users, 
  classes, 
  quizSubmissions,
  students,
  lessonProgress,
  adminLogs,
  currencyTransactions,
  storeSettings,
  purchaseRequests,
  type User, 
  type InsertUser,
  type UpdateUserProfile,
  type UpdatePassword,
  type Class,
  type InsertClass,
  type QuizSubmission,
  type InsertQuizSubmission,
  type LessonProgress,
  type InsertLessonProgress,
  type AdminLog,
  type InsertAdminLog,
  type CurrencyTransaction,
  type InsertCurrencyTransaction,
  type Student
} from "@shared/schema";
import { generatePassportCode, CURRENCY_CONSTANTS } from "@shared/currency-types";
import { db } from "./db";
import { randomBytes } from "crypto";
import { eq, desc, count, and, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import { FEATURE_FLAGS } from "./feature-flags";
import { createQuizSubmissionFast } from "./services/quizSubmissionService";

export interface IStorage {
  // User operations
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  validateUserPassword(email: string, password: string): Promise<User | null>;
  updateUserProfile(userId: number, profileData: UpdateUserProfile): Promise<User>;
  updateUserPassword(userId: number, currentPassword: string, newPassword: string): Promise<boolean>;
  
  // Class operations
  createClass(classData: InsertClass): Promise<Class>;
  getClassesByTeacherId(teacherId: number): Promise<Class[]>;
  getClassByCode(code: string): Promise<Class | undefined>;
  getClassById(id: number): Promise<Class | undefined>;
  deleteClass(id: number): Promise<void>;
  generateUniqueClassCode(): Promise<string>;
  
  // Quiz submission operations
  createQuizSubmission(submission: InsertQuizSubmission): Promise<QuizSubmission>;
  createQuizSubmissionOptimized(submission: InsertQuizSubmission): Promise<QuizSubmission>;
  getSubmissionsByClassId(classId: number): Promise<(QuizSubmission & { passportCode?: string; currencyBalance?: number })[]>;
  getSubmissionById(id: number): Promise<QuizSubmission & { passportCode?: string; currencyBalance?: number } | undefined>;
  deleteSubmission(id: number): Promise<void>;
  getClassStats(classId: number): Promise<{
    totalSubmissions: number;
    animalDistribution: Record<string, number>;
    personalityDistribution: Record<string, number>;
  }>;
  
  // Lesson progress operations
  markLessonComplete(teacherId: number, classId: number, lessonId: number): Promise<LessonProgress>;
  getClassProgress(classId: number): Promise<number[]>;
  isLessonComplete(teacherId: number, classId: number, lessonId: number): Promise<boolean>;
  
  // Admin operations
  getAllTeachers(): Promise<(User & { classCount: number; submissionCount: number })[]>;
  updateUserAdmin(userId: number, isAdmin: boolean): Promise<User>;
  resetUserPassword(userId: number): Promise<string>;
  updateUserSchool(userId: number, schoolName: string): Promise<User>;
  deleteUser(userId: number): Promise<void>;
  getAllClassesWithStats(): Promise<(Class & { teacherName: string; submissionCount: number })[]>;
  getAdminStats(): Promise<{
    totalTeachers: number;
    totalClasses: number;
    totalSubmissions: number;
    recentSignups: number;
    topSchools: { school: string; count: number }[];
    animalDistribution: Record<string, number>;
  }>;
  logAdminAction(log: InsertAdminLog): Promise<AdminLog>;
  updateLastLogin(userId: number): Promise<void>;
  
  // Currency operations
  updateCurrencyBalance(submissionId: number, newBalance: number, tx?: any): Promise<void>;
  createCurrencyTransaction(transaction: InsertCurrencyTransaction, tx?: any): Promise<CurrencyTransaction>;
  giveCurrencyWithTransaction(submissionId: number, amount: number, teacherId: number, reason: string): Promise<{ newBalance: number; transaction: CurrencyTransaction }>;
  takeCurrencyWithTransaction(submissionId: number, amount: number, teacherId: number, reason: string): Promise<{ newBalance: number; actualAmount: number; transaction: CurrencyTransaction }>;
  updateStoreStatus(classId: number, isOpen: boolean): Promise<void>;
  getStoreStatus(classId: number): Promise<{ isOpen: boolean; openedAt?: Date; closesAt?: Date } | null>;
  getCurrencyTransactionsByClass(classId: number): Promise<any[]>;
  getCurrencyTransactionsByStudent(studentId: number): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  async createUser(userData: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        password: hashedPassword,
      })
      .returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async validateUserPassword(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;
    
    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : null;
  }

  async updateUserProfile(userId: number, profileData: UpdateUserProfile): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set(profileData)
      .where(eq(users.id, userId))
      .returning();
    if (!updatedUser) throw new Error("User not found");
    return updatedUser;
  }

  async updateUserPassword(userId: number, currentPassword: string, newPassword: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) return false;
    
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) return false;
    
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await db
      .update(users)
      .set({ password: hashedNewPassword })
      .where(eq(users.id, userId));
    
    return true;
  }

  async generateUniqueClassCode(): Promise<string> {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code: string;
    let isUnique = false;
    
    while (!isUnique) {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(randomBytes(1)[0] / 256 * characters.length));
      }
      
      const existing = await this.getClassByCode(code);
      if (!existing) {
        isUnique = true;
        return code;
      }
    }
    
    throw new Error('Failed to generate unique class code');
  }

  async createClass(classData: InsertClass): Promise<Class> {
    const code = await this.generateUniqueClassCode();
    const [classRecord] = await db
      .insert(classes)
      .values({
        ...classData,
        code,
      })
      .returning();
    return classRecord;
  }

  async getClassesByTeacherId(teacherId: number): Promise<Class[]> {
    return await db.select().from(classes).where(eq(classes.teacherId, teacherId));
  }

  async getClassByCode(code: string): Promise<Class | undefined> {
    const [classRecord] = await db.select().from(classes).where(eq(classes.code, code));
    return classRecord;
  }

  async getClassById(id: number): Promise<Class | undefined> {
    const [classRecord] = await db.select().from(classes).where(eq(classes.id, id));
    return classRecord;
  }

  async deleteClass(id: number): Promise<void> {
    // Delete all related data in proper order to avoid foreign key constraints
    
    // 1. Get all student UUIDs for this class
    const classStudents = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.classId, id));
    
    const studentIds = classStudents.map(s => s.id);
    
    if (studentIds.length > 0) {
      // 2. Delete purchase requests and currency transactions for these students
      await db.delete(purchaseRequests)
        .where(sql`${purchaseRequests.studentId} = ANY(${studentIds})`);
      
      await db.delete(currencyTransactions)
        .where(sql`${currencyTransactions.studentId} = ANY(${studentIds})`);
    }
    
    // 3. Delete store settings for this class
    await db.delete(storeSettings).where(eq(storeSettings.classId, id));
    
    // 4. Delete all quiz submissions for this class
    await db.delete(quizSubmissions).where(eq(quizSubmissions.classId, id));
    
    // 5. Delete all students in this class
    await db.delete(students).where(eq(students.classId, id));
    
    // 6. Delete all lesson progress for this class
    await db.delete(lessonProgress).where(eq(lessonProgress.classId, id));
    
    // 7. Finally delete the class itself
    await db.delete(classes).where(eq(classes.id, id));
  }

  // New optimized method - fast submission with async rewards
  async createQuizSubmissionOptimized(submission: InsertQuizSubmission): Promise<QuizSubmission> {
    return await createQuizSubmissionFast(submission);
  }

  // Original method - kept for backward compatibility
  async createQuizSubmission(submission: InsertQuizSubmission): Promise<QuizSubmission> {
    // Use transaction to ensure both submission and currency reward are atomic
    return await db.transaction(async (tx) => {
      // Generate passport code for the student
      const passportCode = generatePassportCode(submission.animalType);
      
      let studentId: string | null = null;
      
      // NEW LOGIC: Create or update student record if feature flag is enabled
      if (FEATURE_FLAGS.USE_STUDENTS_TABLE) {
        // Check if student already exists with this passport code
        const [existingStudent] = await tx
          .select()
          .from(students)
          .where(eq(students.passportCode, passportCode))
          .limit(1);
        
        if (existingStudent) {
          // Student exists, update their data with quiz results
          const [updatedStudent] = await tx
            .update(students)
            .set({
              gradeLevel: submission.gradeLevel,
              animalType: submission.animalType,
              animalGenius: submission.animalGenius || 'Feeler',
              personalityType: submission.personalityType,
              learningStyle: submission.learningStyle,
              learningScores: submission.learningScores,
              currencyBalance: (existingStudent.currencyBalance || 0) + CURRENCY_CONSTANTS.QUIZ_COMPLETION_REWARD
            })
            .where(eq(students.id, existingStudent.id))
            .returning();
          
          studentId = existingStudent.id;
          console.log(`✅ Updated existing student record: ${submission.studentName} (${passportCode})`);
        } else {
          // Create new student with full profile from quiz
          const [newStudent] = await tx
            .insert(students)
            .values({
              classId: submission.classId,
              displayName: submission.studentName,
              studentName: submission.studentName,
              passportCode: passportCode,
              walletBalance: CURRENCY_CONSTANTS.QUIZ_COMPLETION_REWARD, // 50 coins
              pendingBalance: 0,
              currencyBalance: CURRENCY_CONSTANTS.QUIZ_COMPLETION_REWARD,
              gradeLevel: submission.gradeLevel,
              animalType: submission.animalType,
              animalGenius: submission.animalGenius || 'Feeler',
              personalityType: submission.personalityType,
              learningStyle: submission.learningStyle,
              learningScores: submission.learningScores,
              avatarData: {},
              roomData: {}
            })
            .returning();
          
          studentId = newStudent.id;
          console.log(`✅ Created new student record: ${submission.studentName} (${passportCode})`);
        }
      }
      
      // Add currency system fields to submission
      const enhancedSubmission = {
        ...submission,
        passportCode,
        currencyBalance: CURRENCY_CONSTANTS.QUIZ_COMPLETION_REWARD, // 50 coins for completing quiz
        avatarData: {},
        roomData: { furniture: [] },
        // Include studentId if we're using the new table
        ...(studentId ? { studentId } : {})
      };

      const [submissionRecord] = await tx
        .insert(quizSubmissions)
        .values(enhancedSubmission)
        .returning();

      // Get the class info to find the teacher for the transaction log
      const [classRecord] = await tx
        .select()
        .from(classes)
        .where(eq(classes.id, submission.classId))
        .limit(1);
      
      if (classRecord && studentId) {
        // Log the quiz completion currency reward with the new student ID
        const currencyTransaction: InsertCurrencyTransaction = {
          studentId: studentId, // Use the student UUID instead of submission ID
          teacherId: classRecord.teacherId,
          amount: CURRENCY_CONSTANTS.QUIZ_COMPLETION_REWARD,
          reason: 'Quiz completion reward',
          transactionType: 'quiz_complete'
        };

        await tx.insert(currencyTransactions).values(currencyTransaction);
        console.log(`✅ Awarded ${CURRENCY_CONSTANTS.QUIZ_COMPLETION_REWARD} coins to student ${submissionRecord.studentName} (${passportCode})`);
      } else if (!classRecord) {
        console.warn(`⚠️ Could not award coins - class record not found for class ID ${submission.classId}`);
      }

      return submissionRecord;
    });
  }

  async getSubmissionsByClassId(classId: number): Promise<(QuizSubmission & { passportCode?: string; currencyBalance?: number })[]> {
    // Get all submissions with student data joined
    const allSubmissionsWithStudentData = await db
      .select({
        // All quiz submission fields
        id: quizSubmissions.id,
        studentId: quizSubmissions.studentId,
        classId: quizSubmissions.classId,
        studentName: quizSubmissions.studentName,
        gradeLevel: quizSubmissions.gradeLevel,
        answers: quizSubmissions.answers,
        personalityType: quizSubmissions.personalityType,
        animalType: quizSubmissions.animalType,
        animalGenius: quizSubmissions.animalGenius,
        scores: quizSubmissions.scores,
        learningStyle: quizSubmissions.learningStyle,
        learningScores: quizSubmissions.learningScores,
        completedAt: quizSubmissions.completedAt,
        // Student fields
        passportCode: students.passportCode,
        currencyBalance: students.currencyBalance
      })
      .from(quizSubmissions)
      .leftJoin(students, eq(quizSubmissions.studentId, students.id))
      .where(eq(quizSubmissions.classId, classId))
      .orderBy(desc(quizSubmissions.completedAt));
    
    // Filter to keep only the most recent submission per student
    const uniqueSubmissions = new Map<string, QuizSubmission & { passportCode?: string; currencyBalance?: number }>();
    allSubmissionsWithStudentData.forEach(submission => {
      const studentKey = submission.studentName.toLowerCase().trim();
      const existing = uniqueSubmissions.get(studentKey);
      
      if (!existing || 
          (submission.completedAt && existing.completedAt && 
           submission.completedAt > existing.completedAt)) {
        uniqueSubmissions.set(studentKey, submission);
      }
    });
    
    return Array.from(uniqueSubmissions.values())
      .sort((a, b) => a.studentName.localeCompare(b.studentName));
  }

  async getSubmissionById(id: number): Promise<QuizSubmission & { passportCode?: string; currencyBalance?: number } | undefined> {
    const result = await db
      .select({
        // All quiz submission fields
        id: quizSubmissions.id,
        studentId: quizSubmissions.studentId,
        classId: quizSubmissions.classId,
        studentName: quizSubmissions.studentName,
        gradeLevel: quizSubmissions.gradeLevel,
        answers: quizSubmissions.answers,
        personalityType: quizSubmissions.personalityType,
        animalType: quizSubmissions.animalType,
        animalGenius: quizSubmissions.animalGenius,
        scores: quizSubmissions.scores,
        learningStyle: quizSubmissions.learningStyle,
        learningScores: quizSubmissions.learningScores,
        completedAt: quizSubmissions.completedAt,
        // Student fields
        passportCode: students.passportCode,
        currencyBalance: students.currencyBalance
      })
      .from(quizSubmissions)
      .leftJoin(students, eq(quizSubmissions.studentId, students.id))
      .where(eq(quizSubmissions.id, id))
      .limit(1);
    
    return result[0];
  }

  async deleteSubmission(id: number): Promise<void> {
    await db.delete(quizSubmissions).where(eq(quizSubmissions.id, id));
  }

  async getClassStats(classId: number): Promise<{
    totalSubmissions: number;
    animalDistribution: Record<string, number>;
    personalityDistribution: Record<string, number>;
    learningStyleDistribution: Record<string, number>;
    animalGeniusDistribution: Record<string, number>;
  }> {
    const submissions = await this.getSubmissionsByClassId(classId);
    
    const animalDistribution: Record<string, number> = {};
    const personalityDistribution: Record<string, number> = {};
    const learningStyleDistribution: Record<string, number> = {};
    const animalGeniusDistribution: Record<string, number> = {};
    
    submissions.forEach(submission => {
      // Count animals
      animalDistribution[submission.animalType] = (animalDistribution[submission.animalType] || 0) + 1;
      
      // Count personality types
      personalityDistribution[submission.personalityType] = (personalityDistribution[submission.personalityType] || 0) + 1;
      
      // Count learning styles
      if (submission.learningStyle) {
        learningStyleDistribution[submission.learningStyle] = (learningStyleDistribution[submission.learningStyle] || 0) + 1;
      }
      
      // Count animal genius categories
      if (submission.animalGenius) {
        animalGeniusDistribution[submission.animalGenius] = (animalGeniusDistribution[submission.animalGenius] || 0) + 1;
      }
    });
    
    return {
      totalSubmissions: submissions.length,
      animalDistribution,
      personalityDistribution,
      learningStyleDistribution,
      animalGeniusDistribution,
    };
  }

  async markLessonComplete(teacherId: number, classId: number, lessonId: number): Promise<LessonProgress> {
    // Check if already completed
    const existing = await db
      .select()
      .from(lessonProgress)
      .where(and(
        eq(lessonProgress.teacherId, teacherId),
        eq(lessonProgress.classId, classId),
        eq(lessonProgress.lessonId, lessonId)
      ));

    if (existing.length > 0) {
      return existing[0];
    }

    const [progress] = await db
      .insert(lessonProgress)
      .values({ teacherId, classId, lessonId })
      .returning();
    
    return progress;
  }

  async getClassProgress(classId: number): Promise<number[]> {
    const progress = await db
      .select()
      .from(lessonProgress)
      .where(eq(lessonProgress.classId, classId));
    
    return progress.map(p => p.lessonId);
  }

  async isLessonComplete(teacherId: number, classId: number, lessonId: number): Promise<boolean> {
    const progress = await db
      .select()
      .from(lessonProgress)
      .where(and(
        eq(lessonProgress.teacherId, teacherId),
        eq(lessonProgress.classId, classId),
        eq(lessonProgress.lessonId, lessonId)
      ));
    
    return progress.length > 0;
  }

  // Admin operations
  async getAllTeachers(): Promise<(User & { classCount: number; submissionCount: number })[]> {
    // Single query to get teachers with both class count and submission count
    const teachersWithStats = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        password: users.password,
        schoolOrganization: users.schoolOrganization,
        roleTitle: users.roleTitle,
        howHeardAbout: users.howHeardAbout,
        personalityAnimal: users.personalityAnimal,
        isAdmin: users.isAdmin,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        classCount: sql<number>`COUNT(DISTINCT ${classes.id})`.as('classCount'),
        submissionCount: sql<number>`COUNT(DISTINCT ${quizSubmissions.id})`.as('submissionCount')
      })
      .from(users)
      .leftJoin(classes, eq(users.id, classes.teacherId))
      .leftJoin(quizSubmissions, eq(classes.id, quizSubmissions.classId))
      .groupBy(
        users.id, 
        users.firstName, 
        users.lastName, 
        users.email, 
        users.password,
        users.schoolOrganization, 
        users.roleTitle, 
        users.howHeardAbout,
        users.personalityAnimal, 
        users.isAdmin, 
        users.lastLoginAt, 
        users.createdAt
      );

    return teachersWithStats;
  }

  async updateUserAdmin(userId: number, isAdmin: boolean): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isAdmin })
      .where(eq(users.id, userId))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async resetUserPassword(userId: number): Promise<string> {
    const user = await this.getUserById(userId);
    if (!user) throw new Error("User not found");
    
    const tempPassword = randomBytes(6).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
    
    return tempPassword;
  }

  async updateUserSchool(userId: number, schoolName: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ schoolOrganization: schoolName })
      .where(eq(users.id, userId))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async deleteUser(userId: number): Promise<void> {
    // Delete user's classes and submissions first (cascade)
    const userClasses = await db.select().from(classes).where(eq(classes.teacherId, userId));
    
    for (const cls of userClasses) {
      await db.delete(quizSubmissions).where(eq(quizSubmissions.classId, cls.id));
    }
    
    await db.delete(classes).where(eq(classes.teacherId, userId));
    await db.delete(lessonProgress).where(eq(lessonProgress.teacherId, userId));
    await db.delete(users).where(eq(users.id, userId));
  }

  async getAllClassesWithStats(): Promise<(Class & { teacherName: string; submissionCount: number })[]> {
    // Single query to get classes with teacher info and submission count
    const classesWithStats = await db
      .select({
        id: classes.id,
        name: classes.name,
        code: classes.code,
        teacherId: classes.teacherId,
        iconEmoji: classes.iconEmoji,
        iconColor: classes.iconColor,
        createdAt: classes.createdAt,
        teacherName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`.as('teacherName'),
        submissionCount: sql<number>`COUNT(${quizSubmissions.id})`.as('submissionCount')
      })
      .from(classes)
      .innerJoin(users, eq(classes.teacherId, users.id))
      .leftJoin(quizSubmissions, eq(classes.id, quizSubmissions.classId))
      .groupBy(
        classes.id,
        classes.name,
        classes.code,
        classes.teacherId,
        classes.iconEmoji,
        classes.iconColor,
        classes.createdAt,
        users.firstName,
        users.lastName
      );

    return classesWithStats;
  }

  async getAdminStats(): Promise<{
    totalTeachers: number;
    totalClasses: number;
    totalSubmissions: number;
    recentSignups: number;
    topSchools: { school: string; count: number }[];
    animalDistribution: Record<string, number>;
    learningStyleDistribution: Record<string, number>;
  }> {
    const [teacherCount] = await db.select({ count: count() }).from(users);
    const [classCount] = await db.select({ count: count() }).from(classes);
    const [submissionCount] = await db.select({ count: count() }).from(quizSubmissions);
    
    // Recent signups (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const [recentSignups] = await db
      .select({ count: count() })
      .from(users)
      .where(sql`${users.createdAt} >= ${weekAgo}`);

    // Top schools
    const topSchools = await db
      .select({
        school: users.schoolOrganization,
        count: count(),
      })
      .from(users)
      .groupBy(users.schoolOrganization)
      .orderBy(desc(count()))
      .limit(5);

    // Animal distribution
    const animals = await db
      .select({
        animal: quizSubmissions.animalType,
        count: count(),
      })
      .from(quizSubmissions)
      .groupBy(quizSubmissions.animalType);

    const animalDistribution: Record<string, number> = {};
    animals.forEach(({ animal, count }) => {
      animalDistribution[animal] = count;
    });

    // Learning style distribution
    const learningStyles = await db
      .select({
        learningStyle: quizSubmissions.learningStyle,
        count: count(),
      })
      .from(quizSubmissions)
      .where(sql`${quizSubmissions.learningStyle} IS NOT NULL`)
      .groupBy(quizSubmissions.learningStyle);

    const learningStyleDistribution: Record<string, number> = {};
    learningStyles.forEach(({ learningStyle, count }) => {
      if (learningStyle) {
        learningStyleDistribution[learningStyle] = count;
      }
    });

    return {
      totalTeachers: teacherCount.count,
      totalClasses: classCount.count,
      totalSubmissions: submissionCount.count,
      recentSignups: recentSignups.count,
      topSchools: topSchools.map(s => ({ school: s.school, count: s.count })),
      animalDistribution,
      learningStyleDistribution,
    };
  }

  async logAdminAction(log: InsertAdminLog): Promise<AdminLog> {
    const [adminLog] = await db.insert(adminLogs).values(log).returning();
    return adminLog;
  }

  async updateLastLogin(userId: number): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, userId));
  }

  // Currency Management Methods
  
  async updateCurrencyBalance(submissionId: number, newBalance: number, tx?: any): Promise<void> {
    const executor = tx || db;
    await executor
      .update(quizSubmissions)
      .set({ currencyBalance: newBalance })
      .where(eq(quizSubmissions.id, submissionId));
  }

  async createCurrencyTransaction(transaction: InsertCurrencyTransaction, tx?: any): Promise<CurrencyTransaction> {
    const executor = tx || db;
    const [transactionRecord] = await executor
      .insert(currencyTransactions)
      .values(transaction)
      .returning();
    return transactionRecord;
  }

  async giveCurrencyWithTransaction(submissionId: number, amount: number, teacherId: number, reason: string): Promise<{ newBalance: number; transaction: CurrencyTransaction }> {
    return await db.transaction(async (tx) => {
      // New logic: always work with students table
      const [submission] = await tx
        .select({ studentId: quizSubmissions.studentId })
        .from(quizSubmissions)
        .where(eq(quizSubmissions.id, submissionId))
        .limit(1);
      
      if (!submission || !submission.studentId) {
        throw new Error("Student not found");
      }
      
      const [student] = await tx
        .select({ currencyBalance: students.currencyBalance })
        .from(students)
        .where(eq(students.id, submission.studentId))
        .limit(1);
      
      if (!student) {
        throw new Error("Student record not found");
      }
      
      const newBalance = (student.currencyBalance || 0) + amount;
      
      // Update balance in students table
      await tx
        .update(students)
        .set({ currencyBalance: newBalance })
        .where(eq(students.id, submission.studentId));
      
      // Create transaction record with student ID
      const transaction = await this.createCurrencyTransaction({
        studentId: submission.studentId,
        teacherId,
        amount,
        reason: reason || 'Teacher bonus',
        transactionType: 'teacher_gift'
      }, tx);
      
      return { newBalance, transaction };
    });
  }

  async takeCurrencyWithTransaction(submissionId: number, amount: number, teacherId: number, reason: string): Promise<{ newBalance: number; actualAmount: number; transaction: CurrencyTransaction }> {
    return await db.transaction(async (tx) => {
      // New logic: always work with students table
      const [submission] = await tx
        .select({ studentId: quizSubmissions.studentId })
        .from(quizSubmissions)
        .where(eq(quizSubmissions.id, submissionId))
        .limit(1);
      
      if (!submission || !submission.studentId) {
        throw new Error("Student not found");
      }
      
      const [student] = await tx
        .select({ currencyBalance: students.currencyBalance })
        .from(students)
        .where(eq(students.id, submission.studentId))
        .limit(1);
      
      if (!student) {
        throw new Error("Student record not found");
      }
      
      const currentBalance = student.currencyBalance || 0;
      const newBalance = Math.max(0, currentBalance - amount);
      const actualAmount = currentBalance - newBalance;
      
      if (actualAmount === 0) {
        throw new Error("Student has no coins to take");
      }
      
      // Update balance in students table
      await tx
        .update(students)
        .set({ currencyBalance: newBalance })
        .where(eq(students.id, submission.studentId));
      
      // Create transaction record with student ID (negative amount)
      const transaction = await this.createCurrencyTransaction({
        studentId: submission.studentId,
        teacherId,
        amount: -actualAmount,
        reason: reason || 'Teacher adjustment',
        transactionType: 'teacher_gift'
      }, tx);
      
      return { newBalance, actualAmount, transaction };
    });
  }

  async updateStoreStatus(classId: number, isOpen: boolean): Promise<void> {
    // Check if store settings exist for this class
    const [existingSettings] = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.classId, classId))
      .limit(1);

    if (existingSettings) {
      // Update existing settings
      await db
        .update(storeSettings)
        .set({ 
          isOpen,
          openedAt: isOpen ? new Date() : existingSettings.openedAt,
          closesAt: isOpen ? null : new Date()
        })
        .where(eq(storeSettings.classId, classId));
    } else {
      // Create new settings
      await db
        .insert(storeSettings)
        .values({
          classId,
          isOpen,
          openedAt: isOpen ? new Date() : null,
          closesAt: null
        });
    }
  }

  async getStoreStatus(classId: number): Promise<{ isOpen: boolean; openedAt?: Date; closesAt?: Date } | null> {
    const [settings] = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.classId, classId))
      .limit(1);

    if (!settings) {
      return { isOpen: false };
    }

    return {
      isOpen: settings.isOpen,
      openedAt: settings.openedAt || undefined,
      closesAt: settings.closesAt || undefined
    };
  }

  async getCurrencyTransactionsByClass(classId: number): Promise<any[]> {
    // Get all transactions for students in this class
    const transactions = await db
      .select({
        id: currencyTransactions.id,
        amount: currencyTransactions.amount,
        reason: currencyTransactions.reason,
        transactionType: currencyTransactions.transactionType,
        createdAt: currencyTransactions.createdAt,
        studentName: students.studentName,
        teacherName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`.as('teacherName')
      })
      .from(currencyTransactions)
      .innerJoin(students, eq(currencyTransactions.studentId, students.id))
      .leftJoin(users, eq(currencyTransactions.teacherId, users.id)) // leftJoin for system transactions
      .where(eq(students.classId, classId))
      .orderBy(desc(currencyTransactions.createdAt))
      .limit(100); // Limit to recent 100 transactions

    return transactions;
  }

  async getCurrencyTransactionsByStudent(studentId: number): Promise<any[]> {
    // Get all transactions for a specific student
    const transactions = await db
      .select({
        id: currencyTransactions.id,
        amount: currencyTransactions.amount,
        reason: currencyTransactions.reason,
        transactionType: currencyTransactions.transactionType,
        createdAt: currencyTransactions.createdAt,
        teacher: {
          firstName: users.firstName,
          lastName: users.lastName
        }
      })
      .from(currencyTransactions)
      .leftJoin(users, eq(currencyTransactions.teacherId, users.id))
      .where(eq(currencyTransactions.studentId, studentId))
      .orderBy(desc(currencyTransactions.createdAt));

    return transactions;
  }
}

export const storage = new DatabaseStorage();

// Export Supabase-specific methods from storage-supabase.ts
export { getProfileById, updateLastLoginSupabase as updateLastLogin } from './storage-supabase';
