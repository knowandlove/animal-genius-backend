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
  | 'room_decoration';

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

// Store catalog - Generated from Avatar Editor
export const STORE_CATALOG: StoreItem[] = [
  {
    id: "explorer",
    name: "Indiana",
    type: "avatar_hat",
    cost: 100,
    description: "Look out for snakes",
    rarity: "common",
    imageUrl: "/avatars/items/hats/explorer.png"
  },
  {
    id: "safari",
    name: "Safari",
    type: "avatar_hat",
    cost: 100,
    description: "Crikey!",
    rarity: "common",
    imageUrl: "/avatars/items/hats/safari.png"
  },
  {
    id: "greenblinds",
    name: "Neon Green Blindz",
    type: "avatar_accessory",
    cost: 100,
    description: "You can still see. Kinda.",
    rarity: "common",
    imageUrl: "/avatars/items/glasses/greenblinds.png"
  },
  {
    id: "hearts",
    name: "Hearts",
    type: "avatar_accessory",
    cost: 100,
    description: "You can see all the love!",
    rarity: "common",
    imageUrl: "/avatars/items/glasses/hearts.png"
  },
  {
    id: "bow_tie",
    name: "bow tie",
    type: "avatar_accessory",
    cost: 100,
    description: "A cool item for your avatar!",
    rarity: "common",
    imageUrl: "/avatars/items/accessories/bow_tie.png"
  },
  {
    id: "necklace",
    name: "necklace",
    type: "avatar_accessory",
    cost: 100,
    description: "A cool item for your avatar!",
    rarity: "common",
    imageUrl: "/avatars/items/accessories/necklace.png"
  },
  // Room furniture (for future phases)
  // Room furniture (Phase 1 - Basic Set)
  {
    id: 'cozy_chair',
    name: 'Cozy Reading Chair',
    type: 'room_furniture',
    cost: 150,
    description: 'The perfect spot to curl up with a good book!',
    rarity: 'common',
    imageUrl: '/furniture/cozy_chair.png'
  },
  {
    id: 'wooden_table',
    name: 'Rustic Wooden Table',
    type: 'room_furniture',
    cost: 200,
    description: 'A sturdy table for all your activities and snacks!',
    rarity: 'common',
    imageUrl: '/furniture/wooden_table.png'
  },
  {
    id: 'bookshelf',
    name: 'Rainbow Bookshelf',
    type: 'room_furniture',
    cost: 250,
    description: 'Show off your colorful book collection!',
    rarity: 'common',
    imageUrl: '/furniture/bookshelf.png'
  },
  {
    id: 'floor_lamp',
    name: 'Starlight Floor Lamp',
    type: 'room_furniture',
    cost: 120,
    description: 'Casts a warm, magical glow in your room.',
    rarity: 'common',
    imageUrl: '/furniture/floor_lamp.png'
  },
  {
    id: 'bean_bag',
    name: 'Squishy Bean Bag',
    type: 'room_furniture',
    cost: 180,
    description: 'Maximum comfort for gaming and relaxing!',
    rarity: 'common',
    imageUrl: '/furniture/bean_bag.png'
  },
  // Room decorations
  {
    id: 'potted_plant',
    name: 'Happy Succulent',
    type: 'room_decoration',
    cost: 60,
    description: 'A cheerful little plant that never needs watering!',
    rarity: 'common',
    imageUrl: '/decorations/potted_plant.png'
  },
  {
    id: 'wall_clock',
    name: 'Tick-Tock Clock',
    type: 'room_decoration',
    cost: 80,
    description: 'Always know when it\'s snack time!',
    rarity: 'common',
    imageUrl: '/decorations/wall_clock.png'
  },
  {
    id: 'rug_circle',
    name: 'Fuzzy Circle Rug',
    type: 'room_decoration',
    cost: 100,
    description: 'Soft and cozy underfoot!',
    rarity: 'common',
    imageUrl: '/decorations/rug_circle.png'
  },
  // Rare items
  {
    id: 'gaming_chair',
    name: 'Pro Gamer Chair',
    type: 'room_furniture',
    cost: 500,
    description: 'Level up your comfort game! RGB lighting included!',
    rarity: 'rare',
    imageUrl: '/furniture/gaming_chair.png'
  },
  {
    id: 'treasure_chest',
    name: 'Mysterious Treasure Chest',
    type: 'room_decoration',
    cost: 400,
    description: 'What secrets does it hold? Only you know!',
    rarity: 'rare',
    imageUrl: '/decorations/treasure_chest.png'
  }
];

// Helper functions for store operations
export function getItemById(itemId: string): StoreItem | undefined {
  return STORE_CATALOG.find(item => item.id === itemId);
}

export function getItemsByType(type: ItemType): StoreItem[] {
  return STORE_CATALOG.filter(item => item.type === type);
}

export function canAffordItem(balance: number, itemCost: number): boolean {
  return balance >= itemCost;
}

// Validation helpers
export function validatePurchaseRequest(itemId: string, studentBalance: number): { valid: boolean; error?: string } {
  const item = getItemById(itemId);
  
  if (!item) {
    return { valid: false, error: 'Item not found in store catalog' };
  }
  
  if (!canAffordItem(studentBalance, item.cost)) {
    return { valid: false, error: 'Insufficient funds' };
  }
  
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