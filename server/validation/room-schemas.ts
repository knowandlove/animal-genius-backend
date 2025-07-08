/**
 * Room and Avatar Data Validation Schemas
 * Prevents XSS attacks by strictly validating all user-controlled data
 */

import { z } from 'zod';

// UUID validation pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Safe string validation - alphanumeric, spaces, hyphens, underscores only
const SAFE_STRING_REGEX = /^[a-zA-Z0-9\s\-_]+$/;

// Color validation - hex colors only
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Furniture item schema
 */
export const furnitureItemSchema = z.object({
  id: z.string().regex(UUID_REGEX, "Invalid item ID format"),
  type: z.string().regex(SAFE_STRING_REGEX, "Invalid furniture type").max(50),
  x: z.number().int().min(0).max(3), // 4x4 grid
  y: z.number().int().min(0).max(3)  // 4x4 grid
});

/**
 * Room data schema
 */
export const roomDataSchema = z.object({
  furniture: z.array(furnitureItemSchema).max(20), // Limit furniture items
  wallpaper: z.string().regex(UUID_REGEX, "Invalid wallpaper ID").optional(),
  flooring: z.string().regex(UUID_REGEX, "Invalid flooring ID").optional(),
  wallColor: z.string().regex(HEX_COLOR_REGEX, "Invalid wall color format").optional(),
  floorColor: z.string().regex(HEX_COLOR_REGEX, "Invalid floor color format").optional()
});

/**
 * Avatar equipped items schema
 */
export const avatarEquippedSchema = z.object({
  hat: z.string().regex(UUID_REGEX, "Invalid hat ID").optional(),
  glasses: z.string().regex(UUID_REGEX, "Invalid glasses ID").optional(),
  accessory: z.string().regex(UUID_REGEX, "Invalid accessory ID").optional()
});

/**
 * Avatar data schema
 */
export const avatarDataSchema = z.object({
  owned: z.array(z.string().regex(UUID_REGEX, "Invalid owned item ID")).max(100).optional(),
  equipped: avatarEquippedSchema.optional(),
  color: z.string().regex(HEX_COLOR_REGEX, "Invalid avatar color").optional()
});

/**
 * Room update request schema
 */
export const roomUpdateRequestSchema = z.object({
  roomData: roomDataSchema
});

/**
 * Avatar update request schema
 */
export const avatarUpdateRequestSchema = z.object({
  avatarData: avatarDataSchema
});

/**
 * Sanitize room data to ensure it's safe
 * This is a fallback - the schema validation should catch everything
 */
export function sanitizeRoomData(data: any): any {
  if (!data || typeof data !== 'object') {
    return { furniture: [] };
  }

  try {
    // Parse through schema to ensure validation
    const validated = roomDataSchema.parse(data);
    return validated;
  } catch (error) {
    console.error('Room data validation failed:', error);
    // Return safe default
    return { furniture: [] };
  }
}

/**
 * Sanitize avatar data to ensure it's safe
 */
export function sanitizeAvatarData(data: any): any {
  if (!data || typeof data !== 'object') {
    return {};
  }

  try {
    // Parse through schema to ensure validation
    const validated = avatarDataSchema.parse(data);
    return validated;
  } catch (error) {
    console.error('Avatar data validation failed:', error);
    // Return safe default
    return {};
  }
}

/**
 * Validate that all item IDs in room/avatar data exist in the student's inventory
 */
export async function validateItemOwnership(
  studentId: string,
  roomData: z.infer<typeof roomDataSchema>,
  ownedItems: string[]
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  const ownedSet = new Set(ownedItems);

  // Check furniture items
  for (const furniture of roomData.furniture || []) {
    if (!ownedSet.has(furniture.id)) {
      errors.push(`Furniture item ${furniture.id} not owned`);
    }
  }

  // Check wallpaper
  if (roomData.wallpaper && !ownedSet.has(roomData.wallpaper)) {
    errors.push(`Wallpaper ${roomData.wallpaper} not owned`);
  }

  // Check flooring
  if (roomData.flooring && !ownedSet.has(roomData.flooring)) {
    errors.push(`Flooring ${roomData.flooring} not owned`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate avatar equipped items against owned items
 */
export function validateAvatarOwnership(
  avatarData: z.infer<typeof avatarDataSchema>,
  ownedItems: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const ownedSet = new Set(ownedItems);

  if (avatarData.equipped) {
    // Check each equipped item
    if (avatarData.equipped.hat && !ownedSet.has(avatarData.equipped.hat)) {
      errors.push(`Hat ${avatarData.equipped.hat} not owned`);
    }
    if (avatarData.equipped.glasses && !ownedSet.has(avatarData.equipped.glasses)) {
      errors.push(`Glasses ${avatarData.equipped.glasses} not owned`);
    }
    if (avatarData.equipped.accessory && !ownedSet.has(avatarData.equipped.accessory)) {
      errors.push(`Accessory ${avatarData.equipped.accessory} not owned`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}