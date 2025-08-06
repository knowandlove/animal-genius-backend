import { db } from '../server/db.js';
import { storeItems, itemTypes } from '../shared/schema.js';
import { seedTypes } from '../shared/schema-gardens.js';
import { eq } from 'drizzle-orm';

async function addSeedStoreItems() {
  try {
    console.log('Adding seed items to store...');
    
    // Get the seeds item type
    const [seedItemType] = await db.select()
      .from(itemTypes)
      .where(eq(itemTypes.code, 'seeds'))
      .limit(1);
      
    if (!seedItemType) {
      console.error('Seeds item type not found!');
      process.exit(1);
    }
    
    console.log('Using item type:', seedItemType.id);
    
    // Get all seed types
    const seeds = await db.select().from(seedTypes);
    
    // Create store items for each seed
    for (const seed of seeds) {
      const storeItem = {
        name: `${seed.name} Seeds`,
        itemTypeId: seedItemType.id,
        cost: seed.purchasePrice,
        description: `Plant ${seed.name} in your garden! Grows in ${seed.baseGrowthHours} hours.`,
        thumbnailUrl: seed.iconEmoji, // Using emoji as placeholder
        isActive: seed.available,
        rarity: seed.rarity || 'common'
      };
      
      await db.insert(storeItems)
        .values(storeItem)
        .onConflictDoNothing();
    }
    
    console.log('Seed store items added successfully!');
    
    // Verify they were added
    const seedItems = await db.select()
      .from(storeItems)
      .where(eq(storeItems.itemTypeId, seedItemType.id));
    
    console.log(`Total seed items in store: ${seedItems.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error adding seed store items:', error);
    process.exit(1);
  }
}

addSeedStoreItems();