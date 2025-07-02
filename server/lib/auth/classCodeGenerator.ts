import { db } from '../../db';
import { classes } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Generates a unique 6-digit code for a class
 * Format: 123456
 * Ensures uniqueness by checking the database
 */
export async function generateUniqueClassCode(): Promise<string> {
  let code: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100; // Safety limit to prevent infinite loops

  while (!isUnique && attempts < maxAttempts) {
    // Generate a 6-digit code
    code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Check for collision in the database
    const existingClass = await db.query.classes.findFirst({
      where: eq(classes.classCode, code),
    });

    if (!existingClass) {
      isUnique = true;
    }
    
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Unable to generate unique class code after maximum attempts');
  }

  return code!;
}

/**
 * Validates a class code format
 * Must be exactly 6 digits
 */
export function isValidClassCode(code: string): boolean {
  const pattern = /^[0-9]{6}$/;
  return pattern.test(code);
}

/**
 * Generates an activation code
 * Format: XXXX-XXXX (e.g., A7B9-X2K4)
 * For future use when payment system is added
 */
export function generateActivationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  
  // Generate two 4-character segments
  for (let segment = 0; segment < 2; segment++) {
    if (segment > 0) code += '-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  
  return code;
}

/**
 * Validates an activation code format
 * Must be XXXX-XXXX pattern
 */
export function isValidActivationCode(code: string): boolean {
  const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  return pattern.test(code);
}

/**
 * Generates a classroom session code
 * Format: 6 digits (same as class code for simplicity)
 * For temporary session access
 */
export function generateSessionCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Validates a session code format
 * Must be 6 digits
 */
export function isValidSessionCode(code: string): boolean {
  const pattern = /^[0-9]{6}$/;
  return pattern.test(code);
}
