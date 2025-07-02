// Type definitions for storage-uuid.ts

export interface SubmissionDetails {
  id: string;
  studentId: string;
  animalType: string;
  animalTypeName: string;
  geniusType: string;
  geniusTypeName: string;
  answers: QuizAnswers;
  coinsEarned: number;
  completedAt: Date | null;
  createdAt: Date;
}

export interface QuizAnswers {
  personalityType?: string;
  learningStyle?: string;
  gradeLevel?: string;
  learningScores?: LearningScores;
  scores?: PersonalityScores;
  [key: string]: unknown; // For additional answer fields
}

export interface LearningScores {
  visual: number;
  auditory: number;
  kinesthetic: number;
  readingWriting: number;
}

export interface PersonalityScores {
  E: number;
  I: number;
  S: number;
  N: number;
  T: number;
  F: number;
  J: number;
  P: number;
}

export interface ClassAnalyticsStudent {
  id: string;
  studentName: string;
  gradeLevel: string;
  personalityType: string;
  animalType: string;
  geniusType: string;
  learningStyle: string;
  learningScores: LearningScores;
  scores?: PersonalityScores | any;
  completedAt: Date | null;
  passportCode: string;
  currencyBalance: number;
}

export interface StoreSettings {
  autoApprovalEnabled?: boolean;
  autoApprovalThreshold?: number;
  requireApproval?: boolean;
  [key: string]: unknown; // Allow additional settings
}

export interface StudentData {
  classId: string;
  studentName: string;
  name?: string; // Legacy field
  gradeLevel: string;
  personalityType?: string;
  animalType?: string;
  geniusType?: string;
  animalGenius?: string; // Legacy field
  learningStyle?: string;
}

export interface QuizSubmissionData {
  studentId: string;
  animalType: string;
  geniusType: string;
  answers: QuizAnswers;
  coinsEarned: number;
}