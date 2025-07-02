// Test avatar positioning consistency
import { config } from 'dotenv';
config();

import { db } from './server/db.js';
import { itemAnimalPositions, storeItems } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function testAvatarPositioning() {
  console.log('🔍 Testing Avatar Positioning System\n');
  
  // Get all positions from database
  const positions = await db.select().from(itemAnimalPositions);
  
  // Group by item
  const itemGroups = new Map<string, any[]>();
  positions.forEach(pos => {
    if (!itemGroups.has(pos.itemId)) {
      itemGroups.set(pos.itemId, []);
    }
    itemGroups.get(pos.itemId)!.push(pos);
  });
  
  console.log(`Found ${itemGroups.size} items with positioning data:\n`);
  
  // Check each item
  for (const [itemId, itemPositions] of itemGroups) {
    console.log(`\n📦 ITEM: ${itemId}`);
    console.log('=' .repeat(50));
    
    // Get store item details
    const [storeItem] = await db
      .select()
      .from(storeItems)
      .where(eq(storeItems.id, itemId))
      .limit(1);
    
    if (storeItem) {
      console.log(`   Name: ${storeItem.name}`);
      console.log(`   Type: ${storeItem.itemType}`);
    }
    
    console.log(`\n   Positions by animal:`);
    itemPositions.forEach(pos => {
      // Calculate what the final scale will be
      const dbScale = pos.scale / 100; // Convert to decimal
      console.log(`   - ${pos.animalType.padEnd(15)} X:${pos.positionX}% Y:${pos.positionY}% Scale:${pos.scale}(db) → ${dbScale}(decimal) Rot:${pos.rotation}°`);
    });
  }
  
  // Check for missing positions
  console.log('\n\n🔎 Checking for missing positions...');
  const animals = ['meerkat', 'panda', 'owl', 'beaver', 'elephant', 'otter', 'parrot', 'border-collie'];
  const items = ['explorer', 'safari', 'greenblinds', 'hearts'];
  
  const missing: string[] = [];
  for (const item of items) {
    for (const animal of animals) {
      const exists = positions.some(p => p.itemId === item && p.animalType === animal);
      if (!exists) {
        missing.push(`${item} on ${animal}`);
      }
    }
  }
  
  if (missing.length > 0) {
    console.log(`\n⚠️  Missing ${missing.length} positions:`);
    missing.forEach(m => console.log(`   - ${m}`));
  } else {
    console.log('\n✅ All items have positions for all animals!');
  }
  
  console.log('\n\nDone!');
}

testAvatarPositioning().catch(console.error);
