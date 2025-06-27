// Fix for passport code generation to use animal-based codes

import { students, classes } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

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
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
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
  // fall back to timestamp-based code
  const timestamp = Date.now().toString(36).toUpperCase().slice(-3);
  return `${prefix}-${timestamp}`;
}

// For classes, we keep the simple format
export async function generateClassPassportCode(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    // Generate XXX-XXX format where X is alphanumeric
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let part1 = '';
    let part2 = '';
    
    for (let i = 0; i < 3; i++) {
      part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const code = `${part1}-${part2}`;
    
    // Check if this code already exists in classes table
    const existing = await db
      .select()
      .from(classes)
      .where(eq(classes.passportCode, code))
      .limit(1);
    
    if (existing.length === 0) {
      return code;
    }
    
    attempts++;
  }
  
  // Fallback to timestamp-based code
  const timestamp = Date.now().toString(36).toUpperCase();
  return `${timestamp.slice(0, 3)}-${timestamp.slice(3, 6)}`;
}
