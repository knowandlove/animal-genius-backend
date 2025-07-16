import { db } from "./db";
import { eq, desc, and, inArray } from "drizzle-orm";
import { students, quizSubmissions, animalTypes, geniusTypes } from "@shared/schema";
import type { ClassAnalyticsStudent, QuizAnswers } from "@shared/types/storage-types";

/**
 * Optimized version of getClassAnalytics that avoids complex window functions
 * Fetches data in 2 simple queries instead of 1 complex query with ROW_NUMBER()
 */
export async function getClassAnalyticsOptimized(classId: string): Promise<ClassAnalyticsStudent[]> {
  try {
    // 1. Get all students in the class
    const classStudents = await db
      .select({
        id: students.id,
        studentName: students.studentName,
        gradeLevel: students.gradeLevel,
        passportCode: students.passportCode,
        currencyBalance: students.currencyBalance,
        personalityType: students.personalityType,
        learningStyle: students.learningStyle
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
      geniusTypeCode: geniusTypes.code,
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
  return classStudents.map((student, index) => {
    const latestSubmission = latestSubmissionMap.get(student.id);
    
    // Use data from students table first, then fallback to JSON answers
    let personalityType = student.personalityType || 'INTJ';
    let learningStyle = student.learningStyle || 'visual';
    let gradeLevel = student.gradeLevel || 'Unknown';
    let scores = null;
    let learningScores = {
      visual: 0,
      auditory: 0,
      kinesthetic: 0,
      readingWriting: 0
    };

    // Try to get additional data from JSON answers if available
    if (latestSubmission?.answers && typeof latestSubmission.answers === 'object') {
      const answers = latestSubmission.answers as QuizAnswers;
      // Only override if students table data is missing
      if (!student.personalityType && answers.personalityType) personalityType = answers.personalityType;
      if (!student.learningStyle && answers.learningStyle) learningStyle = answers.learningStyle;
      if (answers.gradeLevel) gradeLevel = answers.gradeLevel;
      if (answers.scores) scores = answers.scores;
      if (answers.learningScores) learningScores = answers.learningScores;
    }

    return {
      id: student.id, // Use the actual UUID
      studentId: student.id,
      studentName: student.studentName || 'Unknown',
      gradeLevel: gradeLevel,
      personalityType: personalityType,
      animalType: latestSubmission?.animalTypeName || latestSubmission?.animalTypeCode || null,
      animalGenius: latestSubmission?.geniusTypeName || latestSubmission?.geniusTypeCode || null,
      geniusType: latestSubmission?.geniusTypeName || latestSubmission?.geniusTypeCode || null,
      learningStyle: learningStyle,
      learningScores: learningScores,
      scores: scores,
      completedAt: latestSubmission?.completedAt ? new Date(latestSubmission.completedAt) : null,
      passportCode: student.passportCode,
      currencyBalance: student.currencyBalance || 0
    };
  });
  } catch (error) {
    console.error('Error in getClassAnalyticsOptimized:', error);
    throw new Error('Failed to fetch class analytics data');
  }
}