import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

// Common validation schemas
export const schemas = {
  // User registration
  userRegistration: z.object({
    name: z.string().min(1, "Name is required").max(100, "Name too long"),
    email: z.string().email("Invalid email format").max(255, "Email too long"),
    password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password too long"),
    schoolName: z.string().min(1, "School name is required").max(200, "School name too long").optional(),
    personalityAnimal: z.string().max(50, "Invalid animal type").optional()
  }),

  // User login
  userLogin: z.object({
    email: z.string().email("Invalid email format").max(255, "Email too long"),
    password: z.string().min(1, "Password is required").max(100, "Password too long")
  }),

  // Password update
  passwordUpdate: z.object({
    currentPassword: z.string().min(1, "Current password is required").max(100, "Password too long"),
    newPassword: z.string().min(6, "New password must be at least 6 characters").max(100, "Password too long")
  }),

  // Profile update
  profileUpdate: z.object({
    name: z.string().min(1, "Name is required").max(100, "Name too long").optional(),
    schoolName: z.string().min(1, "School name is required").max(200, "School name too long").optional(),
    personalityAnimal: z.string().max(50, "Invalid animal type").optional()
  }),

  // Class creation
  classCreation: z.object({
    name: z.string().min(1, "Class name is required").max(100, "Class name too long"),
    gradeLevel: z.string().min(1, "Grade level is required").max(20, "Grade level too long")
  }),

  // Quiz submission
  quizSubmission: z.object({
    classId: z.string().uuid("Invalid class ID"),
    studentName: z.string().min(1, "Student name is required").max(100, "Student name too long"),
    answers: z.array(z.string().max(10, "Invalid answer")).min(1, "At least one answer required"),
    personalityType: z.string().max(10, "Invalid personality type"),
    animalType: z.string().max(50, "Invalid animal type"),
    varkScores: z.object({
      visual: z.number().min(0).max(100),
      auditory: z.number().min(0).max(100),
      reading: z.number().min(0).max(100),
      kinesthetic: z.number().min(0).max(100)
    })
  }),

  // Game settings
  // gameSettings: z.object({ // Removed - game features moved to different server
    timePerQuestion: z.number().int().min(5).max(120, "Time per question must be between 5-120 seconds"),
    showResults: z.boolean().optional(),
    randomizeQuestions: z.boolean().optional()
  }),

  // ID parameters
  idParam: z.object({
    id: z.string().uuid("Invalid UUID format")
  }),
  
  // UUID parameter (alias for clarity)
  uuidParam: z.object({
    id: z.string().uuid("Invalid UUID format")
  }),

  // Class code parameter
  classCodeParam: z.object({
    code: z.string().regex(/^[A-Z0-9]{6}$/, "Invalid class code format")
  }),

  // Admin actions
  adminTeacherUpdate: z.object({
    schoolName: z.string().min(1, "School name is required").max(200, "School name too long").optional()
  })
};

// Validation middleware factory
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      return res.status(400).json({ message: "Invalid request data" });
    }
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid parameters",
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      return res.status(400).json({ message: "Invalid request parameters" });
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      return res.status(400).json({ message: "Invalid query parameters" });
    }
  };
}

// Note: HTML sanitization is not needed because:
// 1. React automatically escapes values to prevent XSS
// 2. Zod validation ensures data conforms to expected types/formats
// 3. Custom sanitizers can break legitimate data and be bypassed
// 
// For any fields that need special handling, use specific Zod transforms
// within the schema definitions above.