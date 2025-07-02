// Fix for passport code generation to use animal-based codes

import { students, classes } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { randomInt } from 'crypto';

// Animal code mapping
const ANIMAL_CODES: Record<string, string> = {
  'Meerkat': 'MKT',
  'Panda': 'PAN',
  'Owl': 'OWL',
  'Beaver': 'BVR',
  'Elephant': 'ELE',
  'Otter': 'OTR',
  'Parrot': 'PAR',
  'Border Collie': 'BDC'
};

export async function generateAnimalPassportCode(animalType: string): Promise<string> {
  // Get the animal prefix
  const prefix = ANIMAL_CODES[animalType] || 'UNK'; // Default to UNK if animal not found
  
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    // Generate 3 random alphanumeric characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let suffix = '';
    for (let i = 0; i < 3; i++) {
      suffix += chars.charAt(randomInt(chars.length));
    }
    
    const code = `${prefix}-${suffix}`;
    
    // Check if this code already exists
    const existing = await db
      .select()
      .from(students)
      .where(eq(students.passportCode, code))
      .limit(1);
    
    if (existing.length === 0) {
      return code;
    }
    
    attempts++;
  }
  
  // If we couldn't generate a unique code after 100 attempts, 
  // fall back to timestamp-based code with random component for better entropy
  const timestamp = Date.now().toString(36).toUpperCase().slice(-2);
  const randomPart = randomInt(10, 99);
  return `${prefix}-${timestamp}${randomPart}`;
}

// For classes, we keep the simple format
export async function generateClassPassportCode(): Promise<string> {
  const maxAttempts = 100;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate XXX-XXX format where X is alphanumeric
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let part1 = '';
    let part2 = '';
    
    for (let i = 0; i < 3; i++) {
      part1 += chars.charAt(randomInt(chars.length));
      part2 += chars.charAt(randomInt(chars.length));
    }
    
    const code = `${part1}-${part2}`;
    
    // Check if this code already exists in classes table
    const existing = await db
      .select()
      .from(classes)
      .where(eq(classes.classCode, code))
      .limit(1);
    
    if (existing.length === 0) {
      return code;
    }
  }
  
  // If we couldn't generate a unique code after many attempts,
  // throw an error instead of using a weak fallback
  throw new Error('Failed to generate a unique class code after multiple attempts');
}
