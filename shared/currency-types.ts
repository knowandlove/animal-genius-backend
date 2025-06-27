// Currency System Types and Constants
// Shared between client and server

// Transaction types for currency movements
export type TransactionType = 
  | 'teacher_gift'      // Teacher manually gives coins
  | 'quiz_complete'     // Automatic reward for completing quiz
  | 'achievement'       // Milestone rewards
  | 'purchase';         // Spending coins in store

// Store item categories
export type ItemType = 
  | 'avatar_hat'
  | 'avatar_accessory' 
  | 'room_furniture'
  | 'room_decoration'
  | 'room_wallpaper'
  | 'room_flooring';

// Purchase request status
export type PurchaseStatus = 'pending' | 'approved' | 'denied';

// Store catalog interface
export interface StoreItem {
  id: string;
  name: string;
  type: ItemType;
  cost: number;
  description: string;
  imageUrl?: string;
  rarity?: 'common' | 'rare' | 'legendary';
  unlockLevel?: number; // Future feature
}

// Student island data structure
export interface StudentIsland {
  id: number;
  passportCode: string;
  studentName: string;
  animalType: string;
  personalityType: string;
  currencyBalance: number;
  avatarData: AvatarData;
  roomData: RoomData;
  className: string;
  completedAt: Date;
}

// Avatar customization data  
export interface AvatarData {
  owned?: string[];       // List of item IDs the student owns
  equipped?: {           // Currently equipped items by slot
    hat?: string;
    glasses?: string;
    accessory?: string;
  };
  color?: string;        // Future feature: avatar color customization
}

// Room decoration data
export interface RoomData {
  furniture: FurnitureItem[];
  wallpaper?: string;
  flooring?: string;
}

export interface FurnitureItem {
  id: string;
  type: string;
  x: number; // 0-3 for 4x4 grid
  y: number; // 0-3 for 4x4 grid
}

// Passport code generation utility
export function generatePassportCode(animalType: string): string {
  // Handle multi-word animal types (e.g., "border collie" -> "BOR")
  const cleanAnimal = animalType.replace(/\s+/g, '');
  const prefix = cleanAnimal.substring(0, 3).toUpperCase().padEnd(3, 'X');
  
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let random = '';
  for (let i = 0; i < 3; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${random}`;
}

// Validate passport code format (handles both legacy and new UUID-based formats)
export function isValidPassportCode(code: string): boolean {
  // Legacy format: ABC-XYZ or ABC-XYZ1
  const legacyFormat = /^[A-Z]{3}-[A-Z0-9]{3,4}$/;
  // New format: 123-A1B or 123-A1B2C (numeric prefix, alphanumeric suffix)
  const newFormat = /^[0-9]+-[A-Z0-9]+$/;
  
  return legacyFormat.test(code) || newFormat.test(code);
}

// Currency constants
export const CURRENCY_CONSTANTS = {
  QUIZ_COMPLETION_REWARD: 50,  // Coins for completing a quiz
  MAX_TRANSACTION_AMOUNT: 1000, // Max coins per teacher gift
  MAX_ITEM_COST: 10000,        // Max cost for store items
  STARTING_BALANCE: 0,         // Starting currency balance
} as const;

// ============================================
// DEPRECATED: Store catalog moved to database!
// ============================================
// The store catalog is now managed in the database (Supabase).
// These exports are kept temporarily for backwards compatibility
// but should NOT be used in new code.
// 
// Use the API endpoints instead:
// - GET /api/store/catalog - Get all store items
// - GET /api/island-page-data/:passportCode - Get page data including store
// ============================================

/** @deprecated Use database/API instead */
export const STORE_CATALOG: StoreItem[] = [];

/** @deprecated This function always returns undefined. Use server data instead. */
export function getItemById(itemId: string): StoreItem | undefined {
  console.warn('getItemById is deprecated. Store items should come from the server.');
  return undefined;
}

/** @deprecated This function always returns empty array. Use server data instead. */
export function getItemsByType(type: ItemType): StoreItem[] {
  console.warn('getItemsByType is deprecated. Store items should come from the server.');
  return [];
}

// This is still valid as it's just a utility
export function canAffordItem(balance: number, itemCost: number): boolean {
  return balance >= itemCost;
}

// Validate purchase request
export function validatePurchaseRequest(itemId: string, balance: number): { valid: boolean; error?: string } {
  if (!itemId) {
    return { valid: false, error: "Item ID is required" };
  }
  
  if (balance < 0) {
    return { valid: false, error: "Invalid balance" };
  }
  
  // Note: Since we moved to database-based items, we can't validate the item here
  // The server will need to fetch the item from the database and validate
  return { valid: true };
}

// Transaction reason templates
export const TRANSACTION_REASONS = {
  QUIZ_COMPLETE: 'Quiz completion reward',
  TEACHER_GIFT: 'Teacher bonus',
  GOOD_BEHAVIOR: 'Excellent behavior',
  PARTICIPATION: 'Great participation',
  IMPROVEMENT: 'Amazing improvement',
  PURCHASE: 'Store purchase',
} as const;
