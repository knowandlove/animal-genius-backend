// Extension types for handling string-based animal and genius types
// These are used temporarily during the conversion process

import { NewStudent, NewQuizSubmission } from './schema';

// Extended types that accept string values for animal and genius types
export interface NewStudentWithStrings extends Omit<NewStudent, 'animalTypeId' | 'geniusTypeId'> {
  animalType?: string;
  animalGenius?: string;
  name?: string; // Support both 'name' and 'studentName' fields
}

export interface NewQuizSubmissionWithStrings extends Omit<NewQuizSubmission, 'animalTypeId' | 'geniusTypeId'> {
  animalType?: string;
  geniusType?: string;
}
