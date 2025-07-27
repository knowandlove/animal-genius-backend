import { db } from "../db";
import { quizSubmissions, students, classes, currencyTransactions, animalTypes, geniusTypes } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { generatePassportCode, CURRENCY_CONSTANTS } from "@shared/currency-types";

/**
 * Maps animal codes to their primary genius type
 * FIXED: Using actual genius type codes from database
 */
const ANIMAL_TO_GENIUS_MAP: Record<string, string> = {
  'meerkat': 'feeler',
  'parrot': 'thinker',
  'otter': 'doer',
  'panda': 'feeler',
  'owl': 'thinker',
  'beaver': 'doer',
  'border-collie': 'doer',
  'elephant': 'feeler'
};

/**
 * Fast quiz submission - creates student and submission in one transaction
 */
export async function createQuizSubmissionFast(submission: any) {
  console.log(`📝 Fast submission for ${submission.studentName}`);
  
  // Generate passport code
  const passportCode = generatePassportCode(submission.animalType);
  
  try {
    // Do everything in a transaction for data consistency
    const result = await db.transaction(async (tx) => {
      // Look up the animal type ID
      const [animalType] = await tx
        .select()
        .from(animalTypes)
        .where(eq(animalTypes.code, submission.animalType.toLowerCase()))
        .limit(1);
        
      if (!animalType) {
        throw new Error(`Animal type not found: ${submission.animalType}`);
      }
      
      // Determine genius type based on animal
      const geniusCode = ANIMAL_TO_GENIUS_MAP[submission.animalType.toLowerCase()] || 'creative';
      const [geniusType] = await tx
        .select()
        .from(geniusTypes)
        .where(eq(geniusTypes.code, geniusCode))
        .limit(1);
        
      if (!geniusType) {
        throw new Error(`Genius type not found: ${geniusCode}`);
      }

      // Check if student already exists with row lock to prevent race conditions
      const [existingStudent] = await tx
        .select()
        .from(students)
        .where(eq(students.passportCode, passportCode))
        .limit(1)
        .for('update'); // Lock the row to prevent concurrent quiz submissions
      
      let studentId: string;
      let currencyBalance: number;
      
      if (existingStudent) {
        // Update existing student with exact balance calculation
        studentId = existingStudent.id;
        currencyBalance = (existingStudent.currencyBalance || 0) + CURRENCY_CONSTANTS.QUIZ_COMPLETION_REWARD;
        
        await tx
          .update(students)
          .set({
            gradeLevel: submission.gradeLevel,
            animalTypeId: animalType.id,
            geniusTypeId: geniusType.id,
            personalityType: submission.personalityType,
            learningStyle: submission.learningStyle,
            // Set exact balance we calculated while holding the lock
            currencyBalance: currencyBalance
          })
          .where(eq(students.id, existingStudent.id));
          
        console.log(`📊 Updated existing student: ${submission.studentName}`);
      } else {
        // Create new student with proper foreign keys
        const [newStudent] = await tx
          .insert(students)
          .values({
            classId: submission.classId,
            studentName: submission.studentName,
            passportCode: passportCode,
            currencyBalance: CURRENCY_CONSTANTS.QUIZ_COMPLETION_REWARD,
            gradeLevel: submission.gradeLevel,
            animalTypeId: animalType.id,
            geniusTypeId: geniusType.id,
            personalityType: submission.personalityType,
            learningStyle: submission.learningStyle,
            avatarData: {},
            roomData: { furniture: [] } // Safe default structure
          })
          .returning();
          
        studentId = newStudent.id;
        currencyBalance = CURRENCY_CONSTANTS.QUIZ_COMPLETION_REWARD;
        console.log(`👤 Created new student: ${submission.studentName}`);
      }
      
      // Now create the quiz submission with the student ID
      const [submissionRecord] = await tx
        .insert(quizSubmissions)
        .values({
          studentId: studentId,
          animalTypeId: animalType.id,
          geniusTypeId: geniusType.id,
          answers: {
            personalityType: submission.personalityType,
            learningStyle: submission.learningStyle,
            gradeLevel: submission.gradeLevel,
            learningScores: submission.learningScores || submission.answers?.learningScores || {
              visual: 0,
              auditory: 0,
              kinesthetic: 0,
              readingWriting: 0
            },
            scores: submission.scores || submission.answers?.scores || {},
            ...submission.answers // Include any other answer data
          },
          coinsEarned: CURRENCY_CONSTANTS.QUIZ_COMPLETION_REWARD
        })
        .returning();

      console.log(`✅ Quiz submitted for ${submission.studentName} (ID: ${submissionRecord.id})`);
      
      // Get class info for transaction log
      const [classRecord] = await tx
        .select()
        .from(classes)
        .where(eq(classes.id, submission.classId))
        .limit(1);
      
      if (classRecord) {
        // Log the currency transaction
        await tx.insert(currencyTransactions).values({
          studentId: studentId,
          teacherId: classRecord.teacherId,
          amount: CURRENCY_CONSTANTS.QUIZ_COMPLETION_REWARD,
          description: 'Quiz completion reward',
          transactionType: 'quiz_complete'
        });
        console.log(`💰 Awarded ${CURRENCY_CONSTANTS.QUIZ_COMPLETION_REWARD} coins to ${submission.studentName}`);
      }
      
      return {
        submissionRecord,
        studentId,
        passportCode,
        currencyBalance: currencyBalance // Use the balance we already calculated
      };
    });
    
    // Return with passport code for immediate display
    return {
      ...result.submissionRecord,
      passportCode: result.passportCode,
      currencyBalance: result.currencyBalance
    };
    
  } catch (error) {
    console.error(`❌ Error processing quiz submission for ${submission.studentName}:`, error);
    throw error;
  }
}

/**
 * Get submission status
 */
export async function getSubmissionStatus(submissionId: string) {
  const [submission] = await db
    .select({
      id: quizSubmissions.id,
      studentId: quizSubmissions.studentId,
      studentBalance: students.currencyBalance,
      studentName: students.studentName
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
    studentName: submission.studentName || 'Unknown',
    isProcessed: true, // Always true now since we do it synchronously
    currentBalance: submission.studentBalance || 0
  };
}
