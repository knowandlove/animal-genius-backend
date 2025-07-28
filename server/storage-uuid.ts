import { 
  profiles,
  classes, 
  quizSubmissions,
  students,
  adminLogs,
  currencyTransactions,
  storeSettings,
  // purchaseRequests, // TODO: Define purchaseRequests table
  studentInventory,
  animalTypes,
  geniusTypes,
  type Profile,
  type NewProfile,
  type Class,
  type NewClass,
  type QuizSubmission,
  type NewQuizSubmission,
  type AdminLog,
  type NewAdminLog,
  type CurrencyTransaction,
  type NewCurrencyTransaction,
  type Student,
  type NewStudent,
  // type PurchaseRequest, // TODO: Define purchaseRequests table
  // type NewPurchaseRequest, // TODO: Define purchaseRequests table
  type StudentInventory,
  type NewStudentInventory
} from "@shared/schema";
import type { 
  SubmissionDetails, 
  ClassAnalyticsStudent, 
  StoreSettings, 
  StudentData,
  QuizSubmissionData,
  QuizAnswers
} from "@shared/types/storage-types";
import { db } from "./db";
import { eq, desc, count, and, sql, inArray } from "drizzle-orm";
import { createClient } from '@supabase/supabase-js';
import { getAnimalTypeId, getGeniusTypeId } from './type-lookup';
import { generateClassPassportCode, generateAnimalPassportCode } from './passport-generator';
import { getClassAnalyticsOptimized } from './storage-uuid-optimized';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface IUUIDStorage {
  // Profile operations (replacing user operations)
  getProfileById(id: string): Promise<Profile | undefined>;
  getProfileByEmail(email: string): Promise<Profile | undefined>;
  updateProfileAdmin(profileId: string, isAdmin: boolean): Promise<Profile>;
  
  // Class operations
  createClass(classData: NewClass): Promise<Class>;
  getClassesByTeacherId(teacherId: string): Promise<Class[]>;
  getClassByClassCode(code: string): Promise<Class | undefined>;
  getClassById(id: string): Promise<Class | undefined>;
  deleteClass(id: string): Promise<void>;
  updateClass(id: string, data: Partial<Class>): Promise<Class>;
  generateUniqueClassCode(): Promise<string>;
  
  // Student operations
  createStudent(studentData: StudentData): Promise<Student>;
  getStudentById(id: string): Promise<Student | undefined>;
  getStudentsByClassId(classId: string): Promise<Student[]>;
  updateStudent(id: string, data: Partial<Student>): Promise<Student>;
  
  // Quiz submission operations
  createQuizSubmission(submission: NewQuizSubmission): Promise<QuizSubmission>;
  getSubmissionsByStudentId(studentId: string): Promise<SubmissionDetails[]>;
  getSubmissionById(id: string): Promise<QuizSubmission | undefined>;
  getClassAnalytics(classId: string): Promise<ClassAnalyticsStudent[]>;
  
  // Purchase and inventory operations
  addToInventory(item: NewStudentInventory): Promise<StudentInventory>;
  getStudentInventory(studentId: string): Promise<StudentInventory[]>;
  
  // Currency operations
  getStudentBalance(studentId: string): Promise<number>;
  createCurrencyTransaction(transaction: NewCurrencyTransaction): Promise<CurrencyTransaction>;
  getCurrencyTransactionsByStudent(studentId: string): Promise<CurrencyTransaction[]>;
  getCurrencyTransactionsByClass(classId: string): Promise<CurrencyTransaction[]>;
  // Atomic currency update - prevents race conditions
  updateCurrencyAtomic(params: {
    studentId: string;
    teacherId: string;
    amount: number;
    transactionType: string;
    description: string;
  }): Promise<{ transaction: CurrencyTransaction; newBalance: number }>;
  
  
  // Admin operations
  getAllProfiles(): Promise<(Profile & { classCount: number; studentCount: number })[]>;
  getAllClassesWithStats(): Promise<(Class & { teacherName: string; studentCount: number })[]>;
  getAdminStats(): Promise<{
    totalTeachers: number;
    totalClasses: number;
    totalStudents: number;
    totalQuizSubmissions: number;
    recentSignups: number;
    animalDistribution: Record<string, number>;
  }>;
  logAdminAction(log: NewAdminLog): Promise<AdminLog>;
  
  // Store settings
  getStoreSettings(teacherId: string): Promise<StoreSettings>;
  updateStoreSettings(teacherId: string, settings: StoreSettings): Promise<void>;
}

export class UUIDStorage implements IUUIDStorage {
  // Profile operations
  async getProfileById(id: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, id));
    return profile;
  }

  async getProfileByEmail(email: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.email, email));
    return profile;
  }

  async updateProfileAdmin(profileId: string, isAdmin: boolean): Promise<Profile> {
    const [profile] = await db
      .update(profiles)
      .set({ isAdmin })
      .where(eq(profiles.id, profileId))
      .returning();
    if (!profile) throw new Error("Profile not found");
    return profile;
  }

  // Class operations
  async generateUniqueClassCode(): Promise<string> {
    return generateClassPassportCode();
  }

  async createClass(classData: NewClass): Promise<Class> {
    // generateUniqueClassCode now handles uniqueness checking internally
    const classCode = await this.generateUniqueClassCode();
    
    const [classRecord] = await db
      .insert(classes)
      .values({
        ...classData,
        classCode,
      })
      .returning();
    
    return classRecord;
  }

  async getClassesByTeacherId(teacherId: string): Promise<Class[]> {
    return await db.select().from(classes).where(and(
      eq(classes.teacherId, teacherId),
      sql`${classes.deletedAt} IS NULL`
    ));
  }

  async getClassesWithStudentCount(teacherId: string): Promise<(Class & { studentCount: number })[]> {
    const result = await db
      .select({
        id: classes.id,
        teacherId: classes.teacherId,
        name: classes.name,
        subject: classes.subject,
        gradeLevel: classes.gradeLevel,
        classCode: classes.classCode,
        schoolName: classes.schoolName,
        icon: classes.icon,
        backgroundColor: classes.backgroundColor,
        numberOfStudents: classes.numberOfStudents,
        isArchived: classes.isArchived,
        hasValuesSet: classes.hasValuesSet,
        valuesSetAt: classes.valuesSetAt,
        createdAt: classes.createdAt,
        updatedAt: classes.updatedAt,
        deletedAt: classes.deletedAt,
        studentCount: sql<number>`COUNT(${students.id})`.as('studentCount')
      })
      .from(classes)
      .leftJoin(students, eq(classes.id, students.classId))
      .where(and(
        eq(classes.teacherId, teacherId),
        sql`${classes.deletedAt} IS NULL`
      ))
      .groupBy(classes.id);
    return result;
  }

  async getClassByClassCode(code: string): Promise<Class | undefined> {
    const [classRecord] = await db.select().from(classes).where(eq(classes.classCode, code));
    return classRecord;
  }

  async getClassById(id: string): Promise<Class | undefined> {
    const [classRecord] = await db.select().from(classes).where(eq(classes.id, id));
    return classRecord;
  }

  async getStudentCountForClass(classId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`COUNT(*)`.as('count') })
      .from(students)
      .where(eq(students.classId, classId));
    return result[0]?.count || 0;
  }

  async deleteClass(id: string): Promise<void> {
    // Soft delete by setting deletedAt timestamp
    await db
      .update(classes)
      .set({ 
        deletedAt: new Date(),
        isArchived: true 
      })
      .where(eq(classes.id, id));
  }

  async updateClass(id: string, data: Partial<Class>): Promise<Class> {
    const [updatedClass] = await db
      .update(classes)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(classes.id, id))
      .returning();
    
    if (!updatedClass) {
      throw new Error('Class not found');
    }
    
    return updatedClass;
  }

  // Student operations
  async createStudent(studentData: StudentData): Promise<Student> {
    if (!studentData.animalType) {
      throw new Error('Animal type is required for student creation');
    }
    
    // Generate passport code using the imported function
    const passportCode = await generateAnimalPassportCode(studentData.animalType);
    
    // Look up the UUIDs for animal and genius types
    const animalTypeId = await getAnimalTypeId(studentData.animalType);
    const geniusTypeId = await getGeniusTypeId(studentData.geniusType || studentData.animalGenius || 'Feeler');
    
    const [student] = await db
      .insert(students)
      .values({
        classId: studentData.classId,
        studentName: studentData.studentName || studentData.name || 'Unknown Student',
        gradeLevel: studentData.gradeLevel,
        personalityType: studentData.personalityType,
        animalTypeId,
        geniusTypeId,
        learningStyle: studentData.learningStyle,
        passportCode,
        currencyBalance: 0,
        avatarData: {},
        roomData: { furniture: [] }
      })
      .returning();
    return student;
  }

  async upsertStudent(studentData: StudentData): Promise<Student> {
    if (!studentData.animalType) {
      throw new Error('Animal type is required for student upsert');
    }
    
    const animalTypeId = await getAnimalTypeId(studentData.animalType);
    const geniusTypeId = await getGeniusTypeId(studentData.geniusType || studentData.animalGenius || 'Feeler');
    const studentName = studentData.studentName || studentData.name || 'Unknown Student';
    
    // Use onConflictDoUpdate for atomic upsert
    const [student] = await db
      .insert(students)
      .values({
        classId: studentData.classId,
        studentName: studentName,
        gradeLevel: studentData.gradeLevel,
        personalityType: studentData.personalityType,
        animalTypeId,
        geniusTypeId,
        learningStyle: studentData.learningStyle,
        passportCode: await generateAnimalPassportCode(studentData.animalType || 'Unknown'),
        currencyBalance: 0,
        avatarData: {},
        roomData: { furniture: [] }
      })
      .onConflictDoUpdate({
        target: [students.classId, students.studentName],
        set: {
          gradeLevel: studentData.gradeLevel,
          personalityType: studentData.personalityType,
          animalTypeId,
          geniusTypeId,
          learningStyle: studentData.learningStyle,
          updatedAt: new Date()
        }
      })
      .returning();
    
    if (!student) throw new Error("Failed to upsert student.");
    return student;
  }

  async getStudentById(id: string): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.id, id));
    return student;
  }

  async getStudentsByClassId(classId: string): Promise<Student[]> {
    return await db.select().from(students).where(eq(students.classId, classId));
  }

  async updateStudent(id: string, data: Partial<Student>): Promise<Student> {
    const [student] = await db
      .update(students)
      .set(data)
      .where(eq(students.id, id))
      .returning();
    if (!student) throw new Error("Student not found");
    return student;
  }

  // Quiz submission operations
  async createQuizSubmission(submission: NewQuizSubmission): Promise<QuizSubmission> {
    const [quizSubmission] = await db
      .insert(quizSubmissions)
      .values(submission)
      .returning();
    return quizSubmission;
  }

  // Transactional quiz submission with coin award
  async submitQuizAndAwardCoins(
    submission: QuizSubmissionData, 
    transaction: NewCurrencyTransaction
  ): Promise<QuizSubmission> {
    return await db.transaction(async (tx) => {
      if (!submission.animalType) {
        throw new Error('Animal type is required for quiz submission');
      }
      
      // Look up the UUIDs for animal and genius types
      const animalTypeId = await getAnimalTypeId(submission.animalType);
      const geniusTypeId = await getGeniusTypeId(submission.geniusType || 'Feeler');
      
      const [quizSubmission] = await tx
        .insert(quizSubmissions)
        .values({
          studentId: submission.studentId,
          animalTypeId,
          geniusTypeId,
          answers: submission.answers,
          coinsEarned: submission.coinsEarned || 50
        })
        .returning();
      
      await tx
        .insert(currencyTransactions)
        .values(transaction);
      
      // Update student's currency balance
      await tx
        .update(students)
        .set({
          currencyBalance: sql`${students.currencyBalance} + ${transaction.amount}`,
          updatedAt: new Date()
        })
        .where(eq(students.id, submission.studentId));
        
      return quizSubmission;
    });
  }

  async getSubmissionsByStudentId(studentId: string): Promise<SubmissionDetails[]> {
    const results = await db
      .select({
        id: quizSubmissions.id,
        studentId: quizSubmissions.studentId,
        animalType: sql<string>`COALESCE(${animalTypes.code}, 'unknown')`,
        animalTypeName: sql<string>`COALESCE(${animalTypes.name}, 'Unknown')`,
        geniusType: sql<string>`COALESCE(${geniusTypes.name}, 'Unknown')`,
        geniusTypeName: sql<string>`COALESCE(${geniusTypes.name}, 'Unknown')`,
        answers: quizSubmissions.answers,
        coinsEarned: sql<number>`COALESCE(${quizSubmissions.coinsEarned}, 0)`,
        completedAt: quizSubmissions.completedAt,
        createdAt: sql<Date>`COALESCE(${quizSubmissions.createdAt}, NOW())`
      })
      .from(quizSubmissions)
      .leftJoin(animalTypes, eq(quizSubmissions.animalTypeId, animalTypes.id))
      .leftJoin(geniusTypes, eq(quizSubmissions.geniusTypeId, geniusTypes.id))
      .where(eq(quizSubmissions.studentId, studentId))
      .orderBy(desc(quizSubmissions.completedAt));
    
    return results.map(row => ({
      ...row,
      answers: row.answers as QuizAnswers
    }));
  }

  async getSubmissionsByClassId(classId: string): Promise<QuizSubmission[]> {
    const studentIdsQuery = db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.classId, classId));

    return await db
      .select()
      .from(quizSubmissions)
      .where(inArray(quizSubmissions.studentId, studentIdsQuery));
  }

  async getSubmissionById(id: string): Promise<QuizSubmission | undefined> {
    const [submission] = await db.select().from(quizSubmissions).where(eq(quizSubmissions.id, id));
    return submission;
  }

  async getClassAnalytics(classId: string): Promise<ClassAnalyticsStudent[]> {
    // Use optimized version that avoids complex window functions
    return getClassAnalyticsOptimized(classId);
  }

  async getClassAnalyticsOld(classId: string): Promise<ClassAnalyticsStudent[]> {
    // Original implementation kept for reference
    const studentsWithData = await db
      .select({
        studentId: students.id,
        studentName: students.studentName,
        studentGradeLevel: students.gradeLevel,
        passportCode: students.passportCode,
        // Submission data
        submissionId: sql`latest_submissions.id`,
        animalType: animalTypes.code,
        animalTypeName: animalTypes.name,
        geniusType: geniusTypes.name,
        answers: sql`latest_submissions.answers`,
        completedAt: sql`latest_submissions.completed_at`,
        // Balance calculation
        currencyBalance: students.currencyBalance
      })
      .from(students)
      .leftJoin(
        db
          .select({
            studentId: quizSubmissions.studentId,
            id: quizSubmissions.id,
            animalTypeId: quizSubmissions.animalTypeId,
            geniusTypeId: quizSubmissions.geniusTypeId,
            answers: quizSubmissions.answers,
            completedAt: quizSubmissions.completedAt,
            rowNum: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${quizSubmissions.studentId} ORDER BY ${quizSubmissions.completedAt} DESC)`.as('rowNum')
          })
          .from(quizSubmissions)
          .as('latest_submissions'),
        and(
          eq(students.id, sql`latest_submissions.student_id`),
          eq(sql`latest_submissions."rowNum"`, 1)
        )
      )
      .leftJoin(animalTypes, eq(sql`latest_submissions.animal_type_id`, animalTypes.id))
      .leftJoin(geniusTypes, eq(sql`latest_submissions.genius_type_id`, geniusTypes.id))
      .where(eq(students.classId, classId));

    // Process the results
    return studentsWithData.map(row => {
      let personalityType = 'INTJ';
      let learningStyle = 'visual';
      let gradeLevel = row.studentGradeLevel || 'Unknown';

      if (row.answers && typeof row.answers === 'object') {
        const answers = row.answers as QuizAnswers;
        if (answers.personalityType) personalityType = answers.personalityType;
        if (answers.learningStyle) learningStyle = answers.learningStyle;
        if (answers.gradeLevel) gradeLevel = answers.gradeLevel;
      }

      // Extract scores if available
      let scores = null;
      if (row.answers && typeof row.answers === 'object') {
        const answers = row.answers as QuizAnswers;
        if (answers.scores) {
          scores = answers.scores;
        }
      }

      return {
        id: row.studentId,
        studentName: row.studentName || 'Unknown',
        gradeLevel: gradeLevel,
        personalityType: personalityType,
        animalType: row.animalTypeName || null,
        geniusType: row.geniusType || null,
        learningStyle: learningStyle,
        learningScores: {
          visual: 0,
          auditory: 0,
          kinesthetic: 0,
          readingWriting: 0
        },
        scores: scores,
        completedAt: row.completedAt as Date | null,
        passportCode: row.passportCode,
        currencyBalance: row.currencyBalance || 0
      };
    });
  }

  // Purchase and inventory operations

  async addToInventory(item: NewStudentInventory): Promise<StudentInventory> {
    const [inventoryItem] = await db
      .insert(studentInventory)
      .values(item)
      .returning();
    return inventoryItem;
  }

  async getStudentInventory(studentId: string): Promise<StudentInventory[]> {
    return await db
      .select()
      .from(studentInventory)
      .where(eq(studentInventory.studentId, studentId));
  }

  // Currency operations
  async getStudentBalance(studentId: string): Promise<number> {
    // Use the database function we created
    const result = await db.execute(sql`SELECT get_student_balance(${studentId}::uuid) as balance`);
    return result.rows[0].balance as number;
  }

  async createCurrencyTransaction(transaction: NewCurrencyTransaction): Promise<CurrencyTransaction> {
    const [currencyTx] = await db
      .insert(currencyTransactions)
      .values(transaction)
      .returning();
    return currencyTx;
  }

  async getCurrencyTransactionsByStudent(studentId: string): Promise<CurrencyTransaction[]> {
    return await db
      .select()
      .from(currencyTransactions)
      .where(eq(currencyTransactions.studentId, studentId))
      .orderBy(desc(currencyTransactions.createdAt));
  }

  async getCurrencyTransactionsByClass(classId: string): Promise<CurrencyTransaction[]> {
    const results = await db
      .select({
        id: currencyTransactions.id,
        studentId: currencyTransactions.studentId,
        amount: currencyTransactions.amount,
        transactionType: currencyTransactions.transactionType,
        description: currencyTransactions.description,
        teacherId: currencyTransactions.teacherId,
        createdAt: currencyTransactions.createdAt,
      })
      .from(currencyTransactions)
      .innerJoin(students, eq(currencyTransactions.studentId, students.id))
      .where(eq(students.classId, classId))
      .orderBy(desc(currencyTransactions.createdAt));
    
    return results;
  }

  // Atomic currency update - prevents race conditions
  async updateCurrencyAtomic(params: {
    studentId: string;
    teacherId: string;
    amount: number;
    transactionType: string;
    description: string;
  }): Promise<{ transaction: CurrencyTransaction; newBalance: number }> {
    // Use a transaction with row locking to ensure atomicity and prevent race conditions
    return await db.transaction(async (tx) => {
      // First, lock the student row for update to prevent concurrent modifications
      const [student] = await tx
        .select({
          id: students.id,
          currencyBalance: students.currencyBalance
        })
        .from(students)
        .where(eq(students.id, params.studentId))
        .limit(1)
        .for('update'); // Pessimistic locking to prevent race conditions
      
      if (!student) {
        throw new Error('Student not found');
      }
      
      // Check if the student has sufficient funds for deductions
      const currentBalance = student.currencyBalance || 0;
      if (params.amount < 0 && currentBalance + params.amount < 0) {
        throw new Error('Insufficient funds');
      }
      
      // Create the currency transaction
      const [currencyTx] = await tx
        .insert(currencyTransactions)
        .values({
          studentId: params.studentId,
          teacherId: params.teacherId,
          amount: params.amount,
          transactionType: params.transactionType,
          description: params.description,
        })
        .returning();
      
      // Update the student's balance - now we can use the exact value we read
      const newBalance = currentBalance + params.amount;
      const [updatedStudent] = await tx
        .update(students)
        .set({
          currencyBalance: newBalance,
          updatedAt: new Date()
        })
        .where(eq(students.id, params.studentId))
        .returning({ currencyBalance: students.currencyBalance });
      
      return {
        transaction: currencyTx,
        newBalance: updatedStudent.currencyBalance
      };
    });
  }


  // Admin operations
  async getAllProfiles(): Promise<(Profile & { classCount: number; studentCount: number })[]> {
    const profilesWithStats = await db
      .select({
        id: profiles.id,
        email: profiles.email,
        fullName: profiles.fullName,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        schoolOrganization: profiles.schoolOrganization,
        roleTitle: profiles.roleTitle,
        howHeardAbout: profiles.howHeardAbout,
        phoneNumber: profiles.phoneNumber,
        personalityAnimal: profiles.personalityAnimal,
        avatarUrl: profiles.avatarUrl,
        isAdmin: profiles.isAdmin,
        isAnonymous: profiles.isAnonymous,
        lastLoginAt: profiles.lastLoginAt,
        createdAt: profiles.createdAt,
        updatedAt: profiles.updatedAt,
        classCount: sql<number>`COUNT(DISTINCT ${classes.id})`.as('classCount'),
        studentCount: sql<number>`COUNT(DISTINCT ${students.id})`.as('studentCount')
      })
      .from(profiles)
      .leftJoin(classes, eq(profiles.id, classes.teacherId))
      .leftJoin(students, eq(classes.id, students.classId))
      .where(eq(profiles.isAnonymous, false))
      .groupBy(profiles.id);

    return profilesWithStats;
  }

  async getAllClassesWithStats(): Promise<(Class & { teacherName: string; studentCount: number })[]> {
    const classesWithStats = await db
      .select({
        id: classes.id,
        name: classes.name,
        createdAt: classes.createdAt,
        updatedAt: classes.updatedAt,
        teacherId: classes.teacherId,
        subject: classes.subject,
        gradeLevel: classes.gradeLevel,
        classCode: classes.classCode,
        schoolName: classes.schoolName,
        icon: classes.icon,
        backgroundColor: classes.backgroundColor,
        isArchived: classes.isArchived,
        numberOfStudents: classes.numberOfStudents,
        hasValuesSet: classes.hasValuesSet,
        valuesSetAt: classes.valuesSetAt,
        deletedAt: classes.deletedAt,
        teacherName: sql<string>`COALESCE(${profiles.fullName}, '')`,
        studentCount: sql<number>`COUNT(${students.id})`.as('studentCount')
      })
      .from(classes)
      .innerJoin(profiles, eq(classes.teacherId, profiles.id))
      .leftJoin(students, eq(classes.id, students.classId))
      .groupBy(classes.id, profiles.fullName);

    return classesWithStats;
  }

  async getAdminStats(): Promise<{
    totalTeachers: number;
    totalClasses: number;
    totalStudents: number;
    totalQuizSubmissions: number;
    recentSignups: number;
    animalDistribution: Record<string, number>;
  }> {
    // Only count non-anonymous profiles as teachers
    const [teacherCount] = await db
      .select({ count: count() })
      .from(profiles)
      .where(eq(profiles.isAnonymous, false));
    const [classCount] = await db.select({ count: count() }).from(classes);
    const [studentCount] = await db.select({ count: count() }).from(students);
    const [submissionCount] = await db.select({ count: count() }).from(quizSubmissions);
    
    // Recent signups (last 7 days) - only non-anonymous
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const [recentSignups] = await db
      .select({ count: count() })
      .from(profiles)
      .where(sql`${profiles.createdAt} >= ${weekAgo} AND ${profiles.isAnonymous} = false`);

    // Animal distribution from quiz submissions
    const animals = await db
      .select({
        animal: animalTypes.name,
        count: count(),
      })
      .from(quizSubmissions)
      .leftJoin(animalTypes, eq(quizSubmissions.animalTypeId, animalTypes.id))
      .groupBy(animalTypes.name);

    const animalDistribution: Record<string, number> = {};
    animals.forEach(({ animal, count }) => {
      if (animal) animalDistribution[animal] = count;
    });

    return {
      totalTeachers: teacherCount.count,
      totalClasses: classCount.count,
      totalStudents: studentCount.count,
      totalQuizSubmissions: submissionCount.count,
      recentSignups: recentSignups.count,
      animalDistribution,
    };
  }

  async logAdminAction(log: NewAdminLog): Promise<AdminLog> {
    const [adminLog] = await db.insert(adminLogs).values(log).returning();
    return adminLog;
  }

  // Store settings
  async getStoreSettings(teacherId: string): Promise<StoreSettings> {
    const [settings] = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.teacherId, teacherId));
    
    return (settings?.settings || {}) as any;
  }

  async updateStoreSettings(teacherId: string, settings: StoreSettings): Promise<void> {
    await db
      .insert(storeSettings)
      .values({ teacherId, settings })
      .onConflictDoUpdate({
        target: storeSettings.teacherId,
        set: { 
          settings,
          updatedAt: new Date()
        },
      });
  }
}

export const uuidStorage = new UUIDStorage();

// Helper function to get user from Supabase auth
export async function getAuthUser(token: string) {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new Error('Invalid authentication token');
  }
  return user;
}

// Helper function to ensure profile exists
export async function ensureProfile(userId: string, email: string, fullName?: string) {
  const existing = await uuidStorage.getProfileById(userId);
  if (!existing) {
    // Profile should be created by trigger, but just in case
    await db.insert(profiles).values({
      id: userId,
      email,
      fullName
    }).onConflictDoNothing();
  }
  return await uuidStorage.getProfileById(userId);
}
