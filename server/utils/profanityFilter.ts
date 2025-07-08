/**
 * Simple profanity filter for pet names
 * In production, consider using a library like bad-words
 */

// Basic list of inappropriate words/patterns
const BLOCKED_PATTERNS = [
  // Add basic inappropriate words here
  // For MVP, keeping it simple
  /\b(admin|administrator|teacher|staff)\b/i,
  /\b(test|debug|dev)\b/i,
  // Common profanity patterns would go here
];

// Reserved names
const RESERVED_NAMES = [
  'system',
  'admin',
  'null',
  'undefined',
  'anonymous'
];

export interface ValidationResult {
  isValid: boolean;
  cleanedName?: string;
  reason?: string;
}

/**
 * Validate and clean a pet name
 */
export function validatePetName(name: string): ValidationResult {
  // Trim and normalize
  const trimmed = name.trim();
  
  // Check length
  if (trimmed.length === 0) {
    return { isValid: false, reason: 'Name cannot be empty' };
  }
  
  if (trimmed.length > 50) {
    return { isValid: false, reason: 'Name too long (max 50 characters)' };
  }
  
  // Check for reserved names
  if (RESERVED_NAMES.includes(trimmed.toLowerCase())) {
    return { isValid: false, reason: 'This name is reserved' };
  }
  
  // Check for blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { isValid: false, reason: 'Name contains inappropriate content' };
    }
  }
  
  // Check for valid characters (letters, numbers, spaces, basic punctuation)
  if (!/^[a-zA-Z0-9\s\-'_.!]+$/.test(trimmed)) {
    return { isValid: false, reason: 'Name contains invalid characters' };
  }
  
  // Clean up multiple spaces
  const cleaned = trimmed.replace(/\s+/g, ' ');
  
  return { isValid: true, cleanedName: cleaned };
}

/**
 * Generate a random safe pet name (fallback)
 */
export function generateSafePetName(): string {
  const adjectives = ['Happy', 'Fluffy', 'Cute', 'Tiny', 'Brave', 'Swift', 'Gentle'];
  const nouns = ['Buddy', 'Friend', 'Pal', 'Star', 'Hero', 'Scout', 'Explorer'];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 100);
  
  return `${adjective}${noun}${number}`;
}