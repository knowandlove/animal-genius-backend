import { z } from 'zod';

// Class creation schema
export const createClassSchema = z.object({
  name: z.string()
    .min(1, "Class name is required")
    .max(255, "Class name must be less than 255 characters")
    .trim(),
  subject: z.string()
    .max(100, "Subject must be less than 100 characters")
    .trim()
    .optional()
    .nullable(),
  gradeLevel: z.string()
    .max(50, "Grade level must be less than 50 characters")
    .trim()
    .optional()
    .nullable(),
  schoolName: z.string()
    .max(255, "School name must be less than 255 characters")
    .trim()
    .optional()
    .nullable(),
  icon: z.string()
    .max(50, "Icon must be less than 50 characters")
    .optional()
    .default('book'),
  backgroundColor: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Background color must be a valid hex color (e.g., #829B79)")
    .optional()
    .default('#829B79'),
  numberOfStudents: z.number()
    .int()
    .positive()
    .max(1000, "Number of students must be less than 1000")
    .optional()
    .nullable()
});

// Class update schema (all fields optional)
export const updateClassSchema = createClassSchema.partial();

// Import students schema
export const importStudentsSchema = z.object({
  students: z.array(z.object({
    studentName: z.string()
      .min(1, "Student name is required")
      .max(255, "Student name must be less than 255 characters"),
    gradeLevel: z.string()
      .max(50, "Grade level must be less than 50 characters")
      .optional()
  }))
  .min(1, "At least one student is required")
  .max(500, "Cannot import more than 500 students at once")
});