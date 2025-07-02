import { z } from 'zod';
import { emailSchema, passwordSchema } from '@shared/validation';

// Registration schema
export const registrationSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string()
    .min(1, "First name is required")
    .max(255, "First name must be less than 255 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "First name can only contain letters, spaces, hyphens, and apostrophes"),
  lastName: z.string()
    .min(1, "Last name is required")
    .max(255, "Last name must be less than 255 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "Last name can only contain letters, spaces, hyphens, and apostrophes"),
  schoolOrganization: z.string()
    .min(1, "School/organization is required")
    .max(255, "School/organization must be less than 255 characters")
    .optional(),
  roleTitle: z.string()
    .max(255, "Role title must be less than 255 characters")
    .optional(),
  howHeardAbout: z.string()
    .max(255, "How heard about must be less than 255 characters")
    .optional(),
  personalityAnimal: z.string()
    .max(50, "Personality animal must be less than 50 characters")
    .optional()
});

// Login schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required")
});

// Password update schema
export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema
});

// Password reset request schema
export const forgotPasswordSchema = z.object({
  email: emailSchema
});

// Password reset schema
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: passwordSchema
});

// Profile update schema
export const updateProfileSchema = z.object({
  firstName: z.string()
    .min(1, "First name is required")
    .max(255, "First name must be less than 255 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "First name can only contain letters, spaces, hyphens, and apostrophes")
    .optional(),
  lastName: z.string()
    .min(1, "Last name is required")
    .max(255, "Last name must be less than 255 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "Last name can only contain letters, spaces, hyphens, and apostrophes")
    .optional(),
  schoolOrganization: z.string()
    .max(255, "School/organization must be less than 255 characters")
    .optional(),
  roleTitle: z.string()
    .max(255, "Role title must be less than 255 characters")
    .optional(),
  howHeardAbout: z.string()
    .max(255, "How heard about must be less than 255 characters")
    .optional(),
  personalityAnimal: z.string()
    .max(50, "Personality animal must be less than 50 characters")
    .optional()
});

// Refresh token schema
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required")
});