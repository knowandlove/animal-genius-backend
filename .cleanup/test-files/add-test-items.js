// Quick script to add test items to the store database
// Run this with: node add-test-items.js

import { db } from './server/db.js';
import { storeItems } from './shared/schema.js';

async function addTestItems() {
  console.log('Adding test items to store...');
  
  const testItems = [
    {
      name: 'Wizard Hat',
      description: 'A magical hat with stars and moons',
      itemType: 'avatar_hat',
      cost: 50,
      rarity: 'rare',
      isActive: true,
      sortOrder: 1
    },
    {
      name: 'Cool Shades',
      description: 'The coolest sunglasses in town',
      itemType: 'avatar_accessory',
      cost: 30,
      rarity: 'common',
      isActive: true,
      sortOrder: 2
    },
    {
      name: 'Pink Glam Wallpaper',
      description: "It's fab. Just fab.",
      itemType: 'room_wallpaper',
      cost: 25,
      rarity: 'common',
      isActive: true,
      sortOrder: 3
    },
    {
      name: 'Cozy Chair',
      description: 'Perfect for reading books',
      itemType: 'room_furniture',
      cost: 40,
      rarity: 'common',
      isActive: true,
      sortOrder: 4
    }
  ];
  
  try {
    const insertedItems = await db
      .insert(storeItems)
      .values(testItems)
      .returning();
    
    console.log('✅ Successfully added test items:');
    insertedItems.forEach(item => {
      console.log(`  - ${item.name} (${item.id})`);
    });
  } catch (error) {
    console.error('❌ Error adding test items:', error);
  }
  
  process.exit(0);
}

addTestItems();
