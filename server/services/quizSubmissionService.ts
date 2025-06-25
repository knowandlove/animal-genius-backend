import { db } from "../db";
import { quizSubmissions, students, classes, currencyTransactions } from "@shared/schema";
import { eq } from "drizzle-orm";
import { generatePassportCode, CURRENCY_CONSTANTS } from "@shared/currency-types";
import type { InsertQuizSubmission, InsertCurrencyTransaction, QuizSubmission } from "@shared/schema";

/**
 * Fast quiz submission - only saves the essential data
 * Returns immediately to avoid bottleneck
 */
export async function createQuizSubmissionFast(submission: InsertQuizSubmission) {
  console.log(`📝 Fast submission for ${submission.studentName}`);
  
  // Generate passport code (this is fast, no DB calls)
  const passportCode = generatePassportCode(submission.animalType);
  
  // Single, fast insert - no transaction needed for one operation
  const [submissionRecord] = await db
    .insert(quizSubmissions)
    .values({
      ...submission,
      // We'll link to student record async
      studentId: null
    })
    .returning();

  console.log(`✅ Quiz submitted quickly for ${submission.studentName} (ID: ${submissionRecord.id})`);
  
  // Schedule async processing AFTER we return
  setImmediate(() => {
    processQuizRewards(submissionRecord.id, submission, passportCode)
      .catch(error => {
        console.error(`❌ Failed to process rewards for submission ${submissionRecord.id}:`, error);
        // Could implement retry logic here
      });
  });
  
  // Return with passport code for immediate display
  return {
    ...submissionRecord,
    passportCode, // Include this so frontend can show it immediately
    currencyBalance: CURRENCY_CONSTANTS.QUIZ_COMPLETION_REWARD // Show expected balance
  } as QuizSubmission & { passportCode: string; currencyBalance: number };
}

/**
 * Process rewards and create student record asynchronously
 * This happens AFTER the student gets their success response
 */
async function processQuizRewards(
  submissionId: number, 
  submission: InsertQuizSubmission,
  passportCode: string
) {
  console.log(`🎁 Processing rewards for ${submission.studentName} (async)`);
  
  try {
    // Use a transaction for the reward processing
    await db.transaction(async (tx) => {
      // Check if student already exists
      const [existingStudent] = await tx
        .select()
        .from(students)
        .where(eq(students.passportCode, passportCode))
        .limit(1);
      
      let studentId: string;
      
      if (existingStudent) {
        // Update existing student
        studentId = existingStudent.id;
        await tx
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
          .where(eq(students.id, existingStudent.id));
          
        console.log(`📊 Updated existing student: ${submission.studentName}`);
      } else {
        // Create new student
        const [newStudent] = await tx
          .insert(students)
          .values({
            classId: submission.classId,
            displayName: submission.studentName,
            studentName: submission.studentName,
            passportCode: passportCode,
            walletBalance: CURRENCY_CONSTANTS.QUIZ_COMPLETION_REWARD,
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
        console.log(`👤 Created new student: ${submission.studentName}`);
      }
      
      // Update the submission with the student ID
      await tx
        .update(quizSubmissions)
        .set({
          studentId: studentId
        })
        .where(eq(quizSubmissions.id, submissionId));
      
      // Get class info for transaction log
      const [classRecord] = await tx
        .select()
        .from(classes)
        .where(eq(classes.id, submission.classId))
        .limit(1);
      
      if (classRecord) {
        // Log the currency transaction
        const currencyTransaction: InsertCurrencyTransaction = {
          studentId: studentId,
          teacherId: classRecord.teacherId,
          amount: CURRENCY_CONSTANTS.QUIZ_COMPLETION_REWARD,
          reason: 'Quiz completion reward',
          transactionType: 'quiz_complete'
        };
        
        await tx.insert(currencyTransactions).values(currencyTransaction);
        console.log(`💰 Awarded ${CURRENCY_CONSTANTS.QUIZ_COMPLETION_REWARD} coins to ${submission.studentName}`);
      }
    });
    
    console.log(`✅ Rewards processed successfully for ${submission.studentName}`);
  } catch (error) {
    console.error(`❌ Error processing rewards for ${submission.studentName}:`, error);
    throw error;
  }
}

/**
 * Get submission status including reward processing
 * Useful for checking if async processing is complete
 */
export async function getSubmissionStatus(submissionId: number) {
  const [submission] = await db
    .select({
      id: quizSubmissions.id,
      studentId: quizSubmissions.studentId,
      studentName: quizSubmissions.studentName,
      hasStudent: students.id,
      studentBalance: students.currencyBalance
    })
    .from(quizSubmissions)
    .leftJoin(students, eq(quizSubmissions.studentId, students.id))
    .where(eq(quizSubmissions.id, submissionId))
    .limit(1);
    
  if (!submission) {
    return null;
  }
  
  return {
    submissionId: submission.id,
    studentName: submission.studentName,
    isProcessed: !!submission.studentId,
    currentBalance: submission.studentBalance || 0
  };
}
