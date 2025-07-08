import { db } from '../server/db';
import { patterns, storeItems } from '@shared/schema';
import { isNotNull } from 'drizzle-orm';

async function checkPatternItems() {
  console.log('🔍 Checking store items linked to patterns...\n');

  // Check store items with pattern IDs
  const patternItems = await db
    .select()
    .from(storeItems)
    .where(isNotNull(storeItems.patternId));

  console.log(`Found ${patternItems.length} store items linked to patterns`);
  
  if (patternItems.length > 0) {
    console.log('\nStore items with patterns:');
    patternItems.forEach(item => {
      console.log(`- ${item.name} (ID: ${item.id}, Pattern: ${item.patternId})`);
    });
  } else {
    console.log('\n⚠️  No store items are linked to patterns!');
    console.log('This is why patterns don\'t appear in the store.');
    console.log('\nTo fix this, you need to:');
    console.log('1. Create store items with itemType = "room_wallpaper" or "room_flooring"');
    console.log('2. Set the patternId field to reference a pattern');
  }

  // Also check patterns without store items
  const allPatterns = await db.select().from(patterns);
  console.log(`\nTotal patterns in database: ${allPatterns.length}`);
  
  process.exit(0);
}

checkPatternItems().catch(console.error);