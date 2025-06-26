import { 
  profiles,
  classes, 
  quizSubmissions,
  students,
  lessonProgress,
  adminLogs,
  currencyTransactions,
  storeSettings,
  purchaseRequests,
  studentInventory,
  type Profile,
  type NewProfile,
  type Class,
  type NewClass,
  type QuizSubmission,
  type NewQuizSubmission,
  type LessonProgress,
  type NewLessonProgress,
  type AdminLog,
  type NewAdminLog,
  type CurrencyTransaction,
  type NewCurrencyTransaction,
  type Student,
  type NewStudent,
  type PurchaseRequest,
  type NewPurchaseRequest,
  type StudentInventory,
  type NewStudentInventory
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, count, and, sql, inArray } from "drizzle-orm";
import { createClient } from '@supabase/supabase-js';

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
  getClassByPassportCode(code: string): Promise<Class | undefined>;
  getClassById(id: string): Promise<Class | undefined>;
  deleteClass(id: string): Promise<void>;
  generateUniquePassportCode(): Promise<string>;
  
  // Student operations
  createStudent(studentData: NewStudent): Promise<Student>;
  getStudentById(id: string): Promise<Student | undefined>;
  getStudentsByClassId(classId: string): Promise<Student[]>;
  updateStudent(id: string, data: Partial<Student>): Promise<Student>;
  
  // Quiz submission operations
  createQuizSubmission(submission: NewQuizSubmission): Promise<QuizSubmission>;
  getSubmissionsByStudentId(studentId: string): Promise<QuizSubmission[]>;
  getSubmissionById(id: string): Promise<QuizSubmission | undefined>;
  
  // Purchase and inventory operations
  createPurchaseRequest(request: NewPurchaseRequest): Promise<PurchaseRequest>;
  getPurchaseRequestsByClassId(classId: string): Promise<PurchaseRequest[]>;
  updatePurchaseRequest(id: string, status: string, processedBy: string): Promise<PurchaseRequest>;
  addToInventory(item: NewStudentInventory): Promise<StudentInventory>;
  getStudentInventory(studentId: string): Promise<StudentInventory[]>;
  
  // Currency operations
  getStudentBalance(studentId: string): Promise<number>;
  createCurrencyTransaction(transaction: NewCurrencyTransaction): Promise<CurrencyTransaction>;
  getCurrencyTransactionsByStudent(studentId: string): Promise<CurrencyTransaction[]>;
  getCurrencyTransactionsByClass(classId: string): Promise<CurrencyTransaction[]>;
  
  // Lesson progress operations
  createOrUpdateLessonProgress(progress: NewLessonProgress): Promise<LessonProgress>;
  getLessonProgressByStudent(studentId: string): Promise<LessonProgress[]>;
  getLessonProgressByClass(classId: string): Promise<LessonProgress[]>;
  
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
  getStoreSettings(teacherId: string): Promise<any>;
  updateStoreSettings(teacherId: string, settings: any): Promise<void>;
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
  async generateUniquePassportCode(): Promise<string> {
    // Use the database function we created
    console.log('Generating passport code...');
    const result = await db.execute(sql`SELECT generate_passport_code() as code`);
    console.log('Database result:', result);
    const code = result.rows[0].code as string;
    console.log('Generated code:', code);
    return code;
  }

  async createClass(classData: NewClass): Promise<Class> {
    const passportCode = await this.generateUniquePassportCode();
    const [classRecord] = await db
      .insert(classes)
      .values({
        ...classData,
        passportCode,
      })
      .returning();
    return classRecord;
  }

  async getClassesByTeacherId(teacherId: string): Promise<Class[]> {
    return await db.select().from(classes).where(eq(classes.teacherId, teacherId));
  }

  async getClassesWithStudentCount(teacherId: string): Promise<(Class & { studentCount: number })[]> {
    const result = await db
      .select({
        id: classes.id,
        teacherId: classes.teacherId,
        name: classes.name,
        subject: classes.subject,
        gradeLevel: classes.gradeLevel,
        passportCode: classes.passportCode,
        schoolName: classes.schoolName,
        isArchived: classes.isArchived,
        createdAt: classes.createdAt,
        updatedAt: classes.updatedAt,
        studentCount: sql<number>`COUNT(${students.id})`.as('studentCount')
      })
      .from(classes)
      .leftJoin(students, eq(classes.id, students.classId))
      .where(eq(classes.teacherId, teacherId))
      .groupBy(classes.id);
    return result;
  }

  async getClassByPassportCode(code: string): Promise<Class | undefined> {
    const [classRecord] = await db.select().from(classes).where(eq(classes.passportCode, code));
    return classRecord;
  }

  async getClassById(id: string): Promise<Class | undefined> {
    const [classRecord] = await db.select().from(classes).where(eq(classes.id, id));
    return classRecord;
  }

  async deleteClass(id: string): Promise<void> {
    // Note: This will fail if students are still in the class due to 'onDelete: restrict'
    await db.delete(classes).where(eq(classes.id, id));
  }

  // Student operations
  async createStudent(studentData: NewStudent): Promise<Student> {
    const passportCode = await this.generateUniquePassportCode();
    const [student] = await db
      .insert(students)
      .values({
        ...studentData,
        passportCode
      })
      .returning();
    return student;
  }

  async upsertStudent(studentData: NewStudent): Promise<Student> {
    const passportCode = await this.generateUniquePassportCode();
    await db
      .insert(students)
      .values({
        ...studentData,
        passportCode
      })
      .onConflictDoNothing({ target: [students.classId, students.name] });

    const [student] = await db
      .select()
      .from(students)
      .where(and(eq(students.classId, studentData.classId), eq(students.name, studentData.name)));
    
    if (!student) throw new Error("Failed to find or create student.");
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
    submission: NewQuizSubmission, 
    transaction: NewCurrencyTransaction
  ): Promise<QuizSubmission> {
    return await db.transaction(async (tx) => {
      const [quizSubmission] = await tx
        .insert(quizSubmissions)
        .values(submission)
        .returning();
      
      await tx
        .insert(currencyTransactions)
        .values(transaction);
        
      return quizSubmission;
    });
  }

  async getSubmissionsByStudentId(studentId: string): Promise<QuizSubmission[]> {
    return await db
      .select()
      .from(quizSubmissions)
      .where(eq(quizSubmissions.studentId, studentId))
      .orderBy(desc(quizSubmissions.completedAt));
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

  // Purchase and inventory operations
  async createPurchaseRequest(request: NewPurchaseRequest): Promise<PurchaseRequest> {
    const [purchaseRequest] = await db
      .insert(purchaseRequests)
      .values(request)
      .returning();
    return purchaseRequest;
  }

  async getPurchaseRequestsByClassId(classId: string): Promise<PurchaseRequest[]> {
    return await db
      .select()
      .from(purchaseRequests)
      .innerJoin(students, eq(purchaseRequests.studentId, students.id))
      .where(eq(students.classId, classId))
      .orderBy(desc(purchaseRequests.requestedAt));
  }

  async updatePurchaseRequest(id: string, status: string, processedBy: string): Promise<PurchaseRequest> {
    const [request] = await db
      .update(purchaseRequests)
      .set({ 
        status, 
        processedBy,
        processedAt: new Date()
      })
      .where(eq(purchaseRequests.id, id))
      .returning();
    if (!request) throw new Error("Purchase request not found");
    return request;
  }

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
    return await db
      .select()
      .from(currencyTransactions)
      .innerJoin(students, eq(currencyTransactions.studentId, students.id))
      .where(eq(students.classId, classId))
      .orderBy(desc(currencyTransactions.createdAt));
  }

  // Lesson progress operations
  async createOrUpdateLessonProgress(progress: NewLessonProgress): Promise<LessonProgress> {
    const [result] = await db
      .insert(lessonProgress)
      .values({
        ...progress,
        attempts: 1,
        lastAttemptedAt: new Date(),
        completedAt: progress.isCompleted ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: [lessonProgress.studentId, lessonProgress.lessonId],
        set: {
          isCompleted: progress.isCompleted,
          score: progress.score,
          attempts: sql`${lessonProgress.attempts} + 1`,
          lastAttemptedAt: new Date(),
          completedAt: progress.isCompleted ? new Date() : sql`${lessonProgress.completedAt}`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async getLessonProgressByStudent(studentId: string): Promise<LessonProgress[]> {
    return await db
      .select()
      .from(lessonProgress)
      .where(eq(lessonProgress.studentId, studentId));
  }

  async getLessonProgressByClass(classId: string): Promise<LessonProgress[]> {
    return await db
      .select()
      .from(lessonProgress)
      .innerJoin(students, eq(lessonProgress.studentId, students.id))
      .where(eq(students.classId, classId));
  }

  // Admin operations
  async getAllProfiles(): Promise<(Profile & { classCount: number; studentCount: number })[]> {
    const profilesWithStats = await db
      .select({
        id: profiles.id,
        email: profiles.email,
        fullName: profiles.fullName,
        isAdmin: profiles.isAdmin,
        createdAt: profiles.createdAt,
        updatedAt: profiles.updatedAt,
        classCount: sql<number>`COUNT(DISTINCT ${classes.id})`.as('classCount'),
        studentCount: sql<number>`COUNT(DISTINCT ${students.id})`.as('studentCount')
      })
      .from(profiles)
      .leftJoin(classes, eq(profiles.id, classes.teacherId))
      .leftJoin(students, eq(classes.id, students.classId))
      .groupBy(profiles.id);

    return profilesWithStats;
  }

  async getAllClassesWithStats(): Promise<(Class & { teacherName: string; studentCount: number })[]> {
    const classesWithStats = await db
      .select({
        id: classes.id,
        teacherId: classes.teacherId,
        name: classes.name,
        subject: classes.subject,
        gradeLevel: classes.gradeLevel,
        passportCode: classes.passportCode,
        schoolName: classes.schoolName,
        isArchived: classes.isArchived,
        createdAt: classes.createdAt,
        updatedAt: classes.updatedAt,
        teacherName: profiles.fullName,
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
    const [teacherCount] = await db.select({ count: count() }).from(profiles);
    const [classCount] = await db.select({ count: count() }).from(classes);
    const [studentCount] = await db.select({ count: count() }).from(students);
    const [submissionCount] = await db.select({ count: count() }).from(quizSubmissions);
    
    // Recent signups (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const [recentSignups] = await db
      .select({ count: count() })
      .from(profiles)
      .where(sql`${profiles.createdAt} >= ${weekAgo}`);

    // Animal distribution from quiz submissions
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
  async getStoreSettings(teacherId: string): Promise<any> {
    const [settings] = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.teacherId, teacherId));
    
    return settings?.settings || {};
  }

  async updateStoreSettings(teacherId: string, settings: any): Promise<void> {
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
