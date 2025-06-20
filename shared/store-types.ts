// Store System Types
// This file contains only the type definitions for the store system
// The actual store data is now stored in the database

export type ItemType = 
  | 'avatar_hat'
  | 'avatar_accessory' 
  | 'room_furniture'
  | 'room_decoration'
  | 'room_wallpaper'
  | 'room_flooring';

export type ItemRarity = 'common' | 'rare' | 'legendary';

export type PurchaseStatus = 'pending' | 'approved' | 'denied';

// Store item interface (matches database schema)
export interface StoreItem {
  id: string;
  name: string;
  description: string | null;
  itemType: ItemType;
  cost: number;
  imageUrl: string | null;
  rarity: ItemRarity;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
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
  wallColor?: string;
  floorColor?: string;
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

// Validate passport code format (3-4 character suffix for legacy support)
export function isValidPassportCode(code: string): boolean {
  return /^[A-Z]{3}-[A-Z0-9]{3,4}$/.test(code);
}

// Currency constants
export const CURRENCY_CONSTANTS = {
  QUIZ_COMPLETION_REWARD: 50,  // Coins for completing a quiz
  MAX_TRANSACTION_AMOUNT: 1000, // Max coins per teacher gift
  MAX_ITEM_COST: 10000,        // Max cost for store items
  STARTING_BALANCE: 0,         // Starting currency balance
} as const;

// Transaction reason templates
export const TRANSACTION_REASONS = {
  QUIZ_COMPLETE: 'Quiz completion reward',
  TEACHER_GIFT: 'Teacher bonus',
  GOOD_BEHAVIOR: 'Excellent behavior',
  PARTICIPATION: 'Great participation',
  IMPROVEMENT: 'Amazing improvement',
  PURCHASE: 'Store purchase',
} as const;

// Helper function to get the correct folder for an item
export function getItemFolder(item: StoreItem): string {
  switch (item.itemType) {
    case 'avatar_hat':
      return 'hats';
    case 'avatar_accessory':
      // Special case for glasses
      if (item.name.toLowerCase().includes('glass') || item.name.toLowerCase().includes('shade')) {
        return 'glasses';
      }
      return 'accessories';
    case 'room_furniture':
      return 'furniture';
    case 'room_decoration':
      return 'decorations';
    case 'room_wallpaper':
      return 'wallpapers';
    case 'room_flooring':
      return 'flooring';
    default:
      return 'misc';
  }
}
