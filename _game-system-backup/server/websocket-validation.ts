import { z } from 'zod';
import { WSMessage } from '../shared/game-types';

// Base message schema
const wsMessageSchema = z.object({
  type: z.string(),
  data: z.any().optional()
});

// Individual message type schemas
const authenticateSchema = z.object({
  ticket: z.string()
});

const teacherCreateGameSchema = z.object({
  gameId: z.string()
});

const joinGameSchema = z.object({
  gameCode: z.string().length(4),
  playerName: z.string().min(1).max(20)
});

const selectAnimalSchema = z.object({
  animalId: z.string()
});

const customizeAvatarSchema = z.object({
  customizations: z.record(z.string(), z.any())
});

const submitAnswerSchema = z.object({
  questionId: z.string(),
  answerId: z.string()
});

const kickPlayerSchema = z.object({
  playerId: z.string()
});

// Map of message types to their validation schemas
const messageSchemas: Record<string, z.ZodSchema<any>> = {
  'authenticate': authenticateSchema,
  'teacher-create-game': teacherCreateGameSchema,
  'join-game': joinGameSchema,
  'select-animal': selectAnimalSchema,
  'customize-avatar': customizeAvatarSchema,
  'submit-answer': submitAnswerSchema,
  'kick-player': kickPlayerSchema,
  // Messages without data
  'player-ready': z.undefined(),
  'start-game': z.undefined(),
  'show-answer': z.undefined(),
  'next-question': z.undefined(),
  'end-game': z.undefined()
};

export function validateWSMessage(rawMessage: any): { valid: boolean; message?: WSMessage; error?: string } {
  try {
    // First validate the base message structure
    const baseResult = wsMessageSchema.safeParse(rawMessage);
    if (!baseResult.success) {
      return { 
        valid: false, 
        error: 'Invalid message structure' 
      };
    }

    const message = baseResult.data;

    // Check if message type is supported
    if (!messageSchemas.hasOwnProperty(message.type)) {
      return { 
        valid: false, 
        error: `Unknown message type: ${message.type}` 
      };
    }

    // Validate message data based on type
    const schema = messageSchemas[message.type];
    if (schema) {
      const dataResult = schema.safeParse(message.data);
      if (!dataResult.success) {
        return { 
          valid: false, 
          error: `Invalid data for message type ${message.type}: ${dataResult.error.errors[0].message}` 
        };
      }
      message.data = dataResult.data; // Use validated data
    }

    return { 
      valid: true, 
      message: message as WSMessage 
    };
  } catch (error) {
    return { 
      valid: false, 
      error: 'Failed to validate message' 
    };
  }
}

// Additional validation helpers
export function sanitizeString(input: string, maxLength: number = 100): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Remove any HTML tags and dangerous characters
  return input
    .substring(0, maxLength)
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>'"]/g, '') // Remove quotes and angle brackets
    .trim();
}

export function isValidGameCode(code: string): boolean {
  return /^[A-Z0-9]{4}$/.test(code);
}

export function isValidPlayerId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length <= 50;
}