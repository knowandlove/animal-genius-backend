import { z } from "zod";

// Enhanced validation schemas for better data integrity
export const studentNameSchema = z
  .string()
  .min(1, "Student name is required")
  .max(100, "Student name must be less than 100 characters")
  .regex(/^[a-zA-Z\s'-]+$/, "Student name can only contain letters, spaces, hyphens, and apostrophes");

export const gradeLevelSchema = z
  .string()
  .min(1, "Grade level is required")
  .max(20, "Grade level must be less than 20 characters");

export const classCodeSchema = z
  .string()
  .length(6, "Class code must be exactly 6 characters")
  .regex(/^[A-Z0-9]+$/, "Class code must contain only uppercase letters and numbers");

export const emailSchema = z
  .string()
  .email("Please enter a valid email address")
  .max(255, "Email must be less than 255 characters");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be less than 128 characters")
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one uppercase letter, one lowercase letter, and one number");

export const schoolNameSchema = z
  .string()
  .min(1, "School/organization name is required")
  .max(200, "School/organization name must be less than 200 characters");

// Quiz answer validation
export const quizAnswerSchema = z.object({
  questionId: z.number().int().positive(),
  answer: z.enum(['A', 'B', 'C', 'D'], { 
    errorMap: () => ({ message: "Answer must be A, B, C, or D" })
  })
});

export const quizAnswersSchema = z.array(quizAnswerSchema)
  .min(1, "At least one answer is required")
  .max(50, "Too many answers provided");

// Validate MBTI type format
export const mbtiTypeSchema = z
  .string()
  .length(4, "MBTI type must be exactly 4 characters")
  .regex(/^[EI][SN][TF][JP]$/, "Invalid MBTI type format");

// Validate animal type
export const animalTypeSchema = z
  .string()
  .min(1, "Animal type is required")
  .max(50, "Animal type must be less than 50 characters");