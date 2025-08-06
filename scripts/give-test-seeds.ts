import { db } from '../server/db.js';
import { studentInventory, storeItems } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function giveTestSeeds() {
  try {
    const studentId = '01986994-0d3c-74e3-b5f4-ab2845733b41';
    
    // Find carrot seeds item
    const [carrotSeeds] = await db
      .select()
      .from(storeItems)
      .where(eq(storeItems.name, 'Carrot Seeds'))
      .limit(1);
    
    if (!carrotSeeds) {
      console.log('No carrot seeds found in store items');
      process.exit(1);
    }
    
    // Give student 5 carrot seeds
    for (let i = 0; i < 5; i++) {
      await db.insert(studentInventory).values({
        studentId,
        storeItemId: carrotSeeds.id
      });
    }
    
    console.log('✅ Gave student 5 carrot seeds');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

giveTestSeeds();