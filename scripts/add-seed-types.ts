import { db } from '../server/db.js';
import { seedTypes } from '../shared/schema-gardens.js';

async function addSeedTypes() {
  try {
    console.log('Adding seed types to database...');
    
    const seeds = [
      // Quick crops (1 day)
      { id: 'tomato', name: 'Tomato', category: 'vegetable', baseGrowthHours: 24, baseSellPrice: 20, purchasePrice: 10, iconEmoji: '🍅', rarity: 'common', available: true },
      { id: 'lettuce', name: 'Lettuce', category: 'vegetable', baseGrowthHours: 24, baseSellPrice: 18, purchasePrice: 8, iconEmoji: '🥬', rarity: 'common', available: true },
      { id: 'radish', name: 'Radish', category: 'vegetable', baseGrowthHours: 24, baseSellPrice: 15, purchasePrice: 7, iconEmoji: '🥕', rarity: 'common', available: true },
      
      // Medium crops (2-3 days)
      { id: 'strawberry', name: 'Strawberry', category: 'fruit', baseGrowthHours: 48, baseSellPrice: 40, purchasePrice: 18, iconEmoji: '🍓', rarity: 'common', available: true },
      { id: 'pepper', name: 'Pepper', category: 'vegetable', baseGrowthHours: 48, baseSellPrice: 35, purchasePrice: 15, iconEmoji: '🌶️', rarity: 'common', available: true },
      { id: 'corn', name: 'Corn', category: 'vegetable', baseGrowthHours: 72, baseSellPrice: 50, purchasePrice: 20, iconEmoji: '🌽', rarity: 'common', available: true },
      
      // Long crops (4-5 days)
      { id: 'pumpkin', name: 'Pumpkin', category: 'vegetable', baseGrowthHours: 96, baseSellPrice: 80, purchasePrice: 30, iconEmoji: '🎃', rarity: 'uncommon', available: true },
      { id: 'watermelon', name: 'Watermelon', category: 'fruit', baseGrowthHours: 120, baseSellPrice: 100, purchasePrice: 40, iconEmoji: '🍉', rarity: 'uncommon', available: true },
      
      // Flowers (various times)
      { id: 'sunflower', name: 'Sunflower', category: 'flower', baseGrowthHours: 48, baseSellPrice: 30, purchasePrice: 12, iconEmoji: '🌻', rarity: 'common', available: true },
      { id: 'rose', name: 'Rose', category: 'flower', baseGrowthHours: 72, baseSellPrice: 45, purchasePrice: 20, iconEmoji: '🌹', rarity: 'uncommon', available: true },
    ];
    
    for (const seed of seeds) {
      await db.insert(seedTypes)
        .values(seed)
        .onConflictDoNothing();
    }
    
    console.log('Seed types added successfully!');
    
    // Verify they were added
    const allSeeds = await db.select().from(seedTypes);
    console.log(`Total seed types in database: ${allSeeds.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error adding seed types:', error);
    process.exit(1);
  }
}

addSeedTypes();