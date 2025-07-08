import { db } from '../server/db';
import { patterns, storeItems } from '@shared/schema';
import { eq, inArray, and } from 'drizzle-orm';

async function removeCSSPatterns() {
  console.log('🗑️  Starting removal of CSS patterns...\n');

  try {
    // Define all the CSS pattern codes to remove
    const cssPatternCodes = [
      // Original patterns with CSS values
      'brick_red_01',
      'wallpaper_floral_01',
      'wallpaper_stripes_01',
      'stone_gray_01',
      'wallpaper_stars_01',
      'wood_oak_01',
      'tile_checkered_01',
      'carpet_blue_01',
      'tile_marble_01',
      'grass_green_01',
      // Hybrid patterns (CSS-based)
      'css-stripes-basic',
      'css-dots-simple',
      'css-checkers-floor'
    ];

    // First, get all pattern IDs that we need to remove
    const patternsToRemove = await db
      .select({ id: patterns.id, code: patterns.code, name: patterns.name })
      .from(patterns)
      .where(inArray(patterns.code, cssPatternCodes));

    if (patternsToRemove.length === 0) {
      console.log('✅ No CSS patterns found to remove');
      process.exit(0);
    }

    console.log(`Found ${patternsToRemove.length} CSS patterns to remove:`);
    patternsToRemove.forEach(p => console.log(`  - ${p.name} (${p.code})`));
    console.log('');

    const patternIds = patternsToRemove.map(p => p.id);

    // Step 1: Remove associated store items
    console.log('🏪 Removing associated store items...');
    const deletedStoreItems = await db
      .delete(storeItems)
      .where(inArray(storeItems.patternId, patternIds))
      .returning({ name: storeItems.name });

    if (deletedStoreItems.length > 0) {
      console.log(`  ✅ Removed ${deletedStoreItems.length} store items`);
      deletedStoreItems.forEach(item => console.log(`     - ${item.name}`));
    } else {
      console.log('  ℹ️  No store items found for these patterns');
    }

    // Step 2: Remove the patterns themselves
    console.log('\n🎨 Removing patterns...');
    const deletedPatterns = await db
      .delete(patterns)
      .where(inArray(patterns.id, patternIds))
      .returning({ name: patterns.name, code: patterns.code });

    console.log(`  ✅ Removed ${deletedPatterns.length} patterns`);
    deletedPatterns.forEach(p => console.log(`     - ${p.name} (${p.code})`));

    // Step 3: Check what patterns remain
    console.log('\n📊 Checking remaining patterns...');
    const remainingPatterns = await db
      .select({ 
        code: patterns.code, 
        name: patterns.name, 
        patternType: patterns.patternType,
        surfaceType: patterns.surfaceType 
      })
      .from(patterns)
      .where(eq(patterns.isActive, true));

    if (remainingPatterns.length > 0) {
      console.log(`\n✨ ${remainingPatterns.length} patterns remaining:`);
      const wallPatterns = remainingPatterns.filter(p => p.surfaceType === 'background');
      const floorPatterns = remainingPatterns.filter(p => p.surfaceType === 'texture');
      
      if (wallPatterns.length > 0) {
        console.log('\n  Wall Patterns:');
        wallPatterns.forEach(p => console.log(`    - ${p.name} (${p.code}) [${p.patternType}]`));
      }
      
      if (floorPatterns.length > 0) {
        console.log('\n  Floor Patterns:');
        floorPatterns.forEach(p => console.log(`    - ${p.name} (${p.code}) [${p.patternType}]`));
      }
    } else {
      console.log('\n⚠️  No patterns remaining in the database!');
      console.log('   The store will show empty pattern sections until you upload custom PNGs.');
    }

    console.log('\n✅ CSS pattern removal completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Upload your custom PNG patterns to Supabase storage');
    console.log('   2. Run seed scripts to add new image-based patterns');
    console.log('   3. The UI will show "coming soon" messages for empty sections');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error removing CSS patterns:', error);
    process.exit(1);
  }
}

// Run the script
removeCSSPatterns();