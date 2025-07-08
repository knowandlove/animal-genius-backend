import { db } from '../server/db.ts';
import { storeItems } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function checkFishbowl() {
  try {
    console.log('🔍 Checking for fishbowl in store...');
    
    const fishbowls = await db
      .select()
      .from(storeItems)
      .where(eq(storeItems.itemTypeId, 'fishbowl_habitat'));
    
    if (fishbowls.length > 0) {
      console.log('✅ Fishbowl already exists in store!');
      console.log('Found:', fishbowls.length, 'fishbowl(s)');
      fishbowls.forEach(fb => {
        console.log(`- ${fb.name} (${fb.id})`);
        console.log(`  Cost: ${fb.cost} coins`);
        console.log(`  Active: ${fb.isActive}`);
      });
    } else {
      console.log('❌ No fishbowl found in store');
    }
    
  } catch (error) {
    console.error('Error checking:', error);
  } finally {
    process.exit(0);
  }
}

checkFishbowl();