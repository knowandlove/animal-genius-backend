import { db } from '../server/db';
import { patterns, storeItems, itemTypes } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';

async function createPatternStoreItems() {
  console.log('🛍️  Creating store items for unlinked patterns...\n');

  // Get patterns without store items
  const unlinkedPatterns = await db
    .select()
    .from(patterns)
    .leftJoin(storeItems, eq(patterns.id, storeItems.patternId))
    .where(isNull(storeItems.id));

  console.log(`Found ${unlinkedPatterns.length} patterns without store items\n`);

  // Get item type IDs
  const [wallpaperType] = await db
    .select()
    .from(itemTypes)
    .where(eq(itemTypes.code, 'room_wallpaper'))
    .limit(1);

  const [flooringType] = await db
    .select()
    .from(itemTypes)
    .where(eq(itemTypes.code, 'room_flooring'))
    .limit(1);

  if (!wallpaperType || !flooringType) {
    console.error('❌ Could not find wallpaper or flooring item types!');
    process.exit(1);
  }

  // Create store items for each unlinked pattern
  for (const row of unlinkedPatterns) {
    const pattern = row.patterns;
    if (!pattern) continue;

    const itemTypeId = pattern.surfaceType === 'background' 
      ? wallpaperType.id 
      : flooringType.id;

    // Determine cost based on pattern type
    const cost = pattern.patternType === 'css' ? 50 : 250; // CSS patterns are cheaper
    const rarity = pattern.patternType === 'css' ? 'common' : 'rare';

    try {
      const [newItem] = await db
        .insert(storeItems)
        .values({
          name: pattern.name,
          description: pattern.description,
          itemTypeId: itemTypeId,
          cost: cost,
          rarity: rarity,
          isActive: true,
          sortOrder: pattern.patternType === 'css' ? 100 : 200, // CSS patterns first
          assetId: null, // Patterns don't need assets
          assetType: 'image',
          thumbnailUrl: pattern.thumbnailUrl,
          patternId: pattern.id
        })
        .returning();

      console.log(`✅ Created store item for ${pattern.name} (${pattern.patternType}, ${cost} coins)`);
    } catch (error) {
      console.error(`❌ Error creating store item for ${pattern.name}:`, error);
    }
  }

  console.log('\n✨ Store item creation completed!');
  process.exit(0);
}

createPatternStoreItems().catch(error => {
  console.error('Failed to create store items:', error);
  process.exit(1);
});