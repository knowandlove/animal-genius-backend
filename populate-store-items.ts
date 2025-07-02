import { db } from './server/db';
import { storeItems, itemTypes } from './shared/schema';
import { eq } from 'drizzle-orm';

async function populateStoreItems() {
  console.log('🛍️ Populating store items...\n');

  try {
    // First, get the item type IDs
    const itemTypesList = await db.select().from(itemTypes);
    const itemTypeMap = new Map(itemTypesList.map(it => [it.code, it.id]));

    // Define store items to add
    const items = [
      // Avatar Hats
      { 
        name: 'Baseball Cap', 
        description: 'A cool baseball cap for your avatar', 
        itemTypeId: itemTypeMap.get('avatar_hat'),
        cost: 50,
        rarity: 'common',
        sortOrder: 1
      },
      { 
        name: 'Wizard Hat', 
        description: 'A magical pointed hat with stars', 
        itemTypeId: itemTypeMap.get('avatar_hat'),
        cost: 150,
        rarity: 'rare',
        sortOrder: 2
      },
      // Avatar Glasses
      { 
        name: 'Sunglasses', 
        description: 'Cool shades to protect from the sun', 
        itemTypeId: itemTypeMap.get('avatar_glasses'),
        cost: 75,
        rarity: 'common',
        sortOrder: 3
      },
      { 
        name: 'Reading Glasses', 
        description: 'Stylish glasses for the studious type', 
        itemTypeId: itemTypeMap.get('avatar_glasses'),
        cost: 60,
        rarity: 'common',
        sortOrder: 4
      },
      // Room Furniture
      { 
        name: 'Comfy Sofa', 
        description: 'A comfortable sofa for your room', 
        itemTypeId: itemTypeMap.get('room_furniture'),
        cost: 200,
        rarity: 'common',
        sortOrder: 5
      },
      { 
        name: 'Study Desk', 
        description: 'Perfect desk for homework and studying', 
        itemTypeId: itemTypeMap.get('room_furniture'),
        cost: 175,
        rarity: 'common',
        sortOrder: 6
      },
      // Room Decorations
      { 
        name: 'Potted Plant', 
        description: 'A lovely green plant to brighten your room', 
        itemTypeId: itemTypeMap.get('room_decoration'),
        cost: 40,
        rarity: 'common',
        sortOrder: 7
      },
      { 
        name: 'Wall Clock', 
        description: 'Never be late with this stylish wall clock', 
        itemTypeId: itemTypeMap.get('room_decoration'),
        cost: 80,
        rarity: 'common',
        sortOrder: 8
      }
    ];

    // Insert items
    let added = 0;
    for (const item of items) {
      if (!item.itemTypeId) {
        console.warn(`⚠️ Skipping ${item.name} - item type not found`);
        continue;
      }

      // Check if item already exists
      const existing = await db.select()
        .from(storeItems)
        .where(eq(storeItems.name, item.name))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(storeItems).values({
          ...item,
          isActive: true
        });
        console.log(`✓ Added: ${item.name}`);
        added++;
      } else {
        console.log(`- Skipped: ${item.name} (already exists)`);
      }
    }

    console.log(`\n✅ Added ${added} store items!`);

  } catch (error) {
    console.error('\n❌ Error populating store items:', error);
  } finally {
    await db.$pool.end();
    process.exit(0);
  }
}

// Run immediately
populateStoreItems();