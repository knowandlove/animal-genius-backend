/**
 * Generate animal-based passport codes for students
 * Format: [ANIMAL]-[RANDOM] (e.g., MEE-X7K for Meerkat)
 */

import { db } from '../../db';
import { students } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Generates a unique passport code for a student based on their animal type
 * @param animalType - The animal type (e.g., 'meerkat', 'panda', etc.)
 * @returns A unique passport code like 'MEE-X7K'
 */
export async function generateAnimalPassportCode(animalType: string): Promise<string> {
  // Get the first 3 letters of the animal type
  const prefix = animalType.slice(0, 3).toUpperCase();
  
  // Characters to use in the random suffix (no confusing characters like 0/O or 1/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  
  let code: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100;
  
  while (!isUnique && attempts < maxAttempts) {
    // Generate a 3-character random suffix
    let suffix = '';
    for (let i = 0; i < 3; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    code = `${prefix}-${suffix}`;
    
    // Check if this code already exists
    const [existing] = await db
      .select()
      .from(students)
      .where(eq(students.passportCode, code))
      .limit(1);
    
    if (!existing) {
      isUnique = true;
    }
    
    attempts++;
  }
  
  if (!isUnique) {
    throw new Error('Unable to generate unique passport code after maximum attempts');
  }
  
  return code!;
}

/**
 * Validates a passport code format
 * Must be XXX-XXX pattern (3 letters, dash, 3 alphanumeric)
 */
export function isValidPassportCode(code: string): boolean {
  const pattern = /^[A-Z]{3}-[A-Z0-9]{3}$/;
  return pattern.test(code);
}
