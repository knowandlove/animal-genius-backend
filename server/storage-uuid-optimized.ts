import { db } from "./db";
import { eq, desc, and, inArray } from "drizzle-orm";
import { students, quizSubmissions, animalTypes, geniusTypes } from "@shared/schema";
import type { ClassAnalyticsStudent, QuizAnswers } from "@shared/types/storage-types";

/**
 * Optimized version of getClassAnalytics that avoids complex window functions
 * Fetches data in 2 simple queries instead of 1 complex query with ROW_NUMBER()
 */
export async function getClassAnalyticsOptimized(classId: string): Promise<ClassAnalyticsStudent[]> {
  // 1. Get all students in the class
  const classStudents = await db
    .select({
      id: students.id,
      studentName: students.studentName,
      gradeLevel: students.gradeLevel,
      passportCode: students.passportCode,
      currencyBalance: students.currencyBalance
    })
    .from(students)
    .where(eq(students.classId, classId));

  if (classStudents.length === 0) {
    return [];
  }

  const studentIds = classStudents.map(s => s.id);
  
  // 2. Get all quiz submissions for these students with joins
  const allSubmissions = await db
    .select({
      studentId: quizSubmissions.studentId,
      submissionId: quizSubmissions.id,
      animalTypeName: animalTypes.name,
      animalTypeCode: animalTypes.code,
      geniusTypeName: geniusTypes.name,
      answers: quizSubmissions.answers,
      completedAt: quizSubmissions.completedAt
    })
    .from(quizSubmissions)
    .leftJoin(animalTypes, eq(quizSubmissions.animalTypeId, animalTypes.id))
    .leftJoin(geniusTypes, eq(quizSubmissions.geniusTypeId, geniusTypes.id))
    .where(inArray(quizSubmissions.studentId, studentIds))
    .orderBy(desc(quizSubmissions.completedAt));

  // 3. Process in memory to get latest submission per student
  const latestSubmissionMap = new Map<string, typeof allSubmissions[0]>();
  
  allSubmissions.forEach(submission => {
    if (!latestSubmissionMap.has(submission.studentId)) {
      latestSubmissionMap.set(submission.studentId, submission);
    }
  });

  // 4. Combine student data with their latest submission
  return classStudents.map(student => {
    const latestSubmission = latestSubmissionMap.get(student.id);
    
    let personalityType = 'INTJ';
    let learningStyle = 'visual';
    let gradeLevel = student.gradeLevel || 'Unknown';
    let scores = null;

    if (latestSubmission?.answers && typeof latestSubmission.answers === 'object') {
      const answers = latestSubmission.answers as QuizAnswers;
      if (answers.personalityType) personalityType = answers.personalityType;
      if (answers.learningStyle) learningStyle = answers.learningStyle;
      if (answers.gradeLevel) gradeLevel = answers.gradeLevel;
      if (answers.scores) scores = answers.scores;
    }

    return {
      id: student.id,
      studentName: student.studentName || 'Unknown',
      gradeLevel: gradeLevel,
      personalityType: personalityType,
      animalType: latestSubmission?.animalTypeName || '',
      geniusType: latestSubmission?.geniusTypeName || '',
      learningStyle: learningStyle,
      learningScores: {
        visual: 0,
        auditory: 0,
        kinesthetic: 0,
        readingWriting: 0
      },
      scores: scores,
      completedAt: latestSubmission?.completedAt || null,
      passportCode: student.passportCode,
      currencyBalance: student.currencyBalance || 0
    };
  });
}