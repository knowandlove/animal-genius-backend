import { Student } from '@shared/schema';
import type { QuizAnswers } from '@shared/types/storage-types';

export interface ParsedSubmissionDetails {
  personalityType: string;
  learningStyle: string;
  gradeLevel: string;
  learningScores: {
    visual: number;
    auditory: number;
    kinesthetic: number;
    readingWriting: number;
  };
  scores?: {
    E: number;
    I: number;
    S: number;
    N: number;
    T: number;
    F: number;
    J: number;
    P: number;
  };
}

export function parseSubmissionDetails(
  submission: { answers?: QuizAnswers } | null, 
  student: Partial<Student> | null
): ParsedSubmissionDetails {
  const defaults: ParsedSubmissionDetails = {
    personalityType: 'INTJ',
    learningStyle: 'visual',
    gradeLevel: student?.gradeLevel || 'Unknown',
    learningScores: {
      visual: 0,
      auditory: 0,
      kinesthetic: 0,
      readingWriting: 0
    },
    scores: {
      E: 0, I: 0, S: 0, N: 0,
      T: 0, F: 0, J: 0, P: 0
    }
  };

  if (!submission?.answers || typeof submission.answers !== 'object') {
    return defaults;
  }

  const answers = submission.answers as QuizAnswers;
  
  return {
    personalityType: answers.personalityType || defaults.personalityType,
    learningStyle: answers.learningStyle || defaults.learningStyle,
    gradeLevel: answers.gradeLevel || defaults.gradeLevel,
    learningScores: answers.learningScores || defaults.learningScores,
    scores: answers.scores || defaults.scores
  };
}