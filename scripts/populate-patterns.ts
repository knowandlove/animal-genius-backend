import { db } from '../server/db';
import { patterns, storeItems, itemTypes } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Initial patterns to populate
const initialPatterns = [
  // Wall Patterns
  {
    code: 'brick_red_01',
    name: 'Red Brick Wall',
    description: 'Classic red brick pattern for a cozy feel',
    surfaceType: 'background' as const,
    theme: 'rustic',
    thumbnailUrl: '/patterns/walls/thumbnails/brick_red_01_thumb.webp'
  },
  {
    code: 'wallpaper_floral_01',
    name: 'Floral Wallpaper',
    description: 'Beautiful floral pattern with soft colors',
    surfaceType: 'background' as const,
    theme: 'nature',
    thumbnailUrl: '/patterns/walls/thumbnails/wallpaper_floral_01_thumb.webp'
  },
  {
    code: 'wallpaper_stripes_01',
    name: 'Striped Wallpaper',
    description: 'Modern vertical stripes in pastel colors',
    surfaceType: 'background' as const,
    theme: 'modern',
    thumbnailUrl: '/patterns/walls/thumbnails/wallpaper_stripes_01_thumb.webp'
  },
  {
    code: 'stone_gray_01',
    name: 'Gray Stone Wall',
    description: 'Natural gray stone texture',
    surfaceType: 'background' as const,
    theme: 'rustic',
    thumbnailUrl: '/patterns/walls/thumbnails/stone_gray_01_thumb.webp'
  },
  {
    code: 'wallpaper_stars_01',
    name: 'Starry Night',
    description: 'Magical stars and moon pattern',
    surfaceType: 'background' as const,
    theme: 'fantasy',
    thumbnailUrl: '/patterns/walls/thumbnails/wallpaper_stars_01_thumb.webp'
  },
  
  // Floor Patterns
  {
    code: 'wood_oak_01',
    name: 'Oak Wood Flooring',
    description: 'Classic oak wood planks',
    surfaceType: 'texture' as const,
    theme: 'rustic',
    thumbnailUrl: '/patterns/floors/thumbnails/wood_oak_01_thumb.webp'
  },
  {
    code: 'tile_checkered_01',
    name: 'Checkered Tiles',
    description: 'Black and white checkered pattern',
    surfaceType: 'texture' as const,
    theme: 'modern',
    thumbnailUrl: '/patterns/floors/thumbnails/tile_checkered_01_thumb.webp'
  },
  {
    code: 'carpet_blue_01',
    name: 'Blue Carpet',
    description: 'Soft blue carpet texture',
    surfaceType: 'texture' as const,
    theme: 'cozy',
    thumbnailUrl: '/patterns/floors/thumbnails/carpet_blue_01_thumb.webp'
  },
  {
    code: 'tile_marble_01',
    name: 'Marble Tiles',
    description: 'Elegant white marble with gray veins',
    surfaceType: 'texture' as const,
    theme: 'luxury',
    thumbnailUrl: '/patterns/floors/thumbnails/tile_marble_01_thumb.webp'
  },
  {
    code: 'grass_green_01',
    name: 'Grass Floor',
    description: 'Fresh green grass texture',
    surfaceType: 'texture' as const,
    theme: 'nature',
    thumbnailUrl: '/patterns/floors/thumbnails/grass_green_01_thumb.webp'
  }
];

async function populatePatterns() {
  console.log('🎨 Starting pattern population...');
  
  try {
    // First, check if we have the room_wallpaper and room_flooring item types
    const wallpaperType = await db.select().from(itemTypes)
      .where(eq(itemTypes.code, 'room_wallpaper'))
      .limit(1);
    
    const flooringType = await db.select().from(itemTypes)
      .where(eq(itemTypes.code, 'room_flooring'))
      .limit(1);
    
    if (wallpaperType.length === 0 || flooringType.length === 0) {
      console.error('❌ Missing item types. Please run populate-lookup-tables.ts first.');
      process.exit(1);
    }
    
    const wallpaperTypeId = wallpaperType[0].id;
    const flooringTypeId = flooringType[0].id;
    
    // Insert patterns
    for (const pattern of initialPatterns) {
      console.log(`  Adding pattern: ${pattern.name}`);
      
      // Insert pattern
      const [insertedPattern] = await db.insert(patterns)
        .values({
          code: pattern.code,
          name: pattern.name,
          description: pattern.description,
          surfaceType: pattern.surfaceType,
          theme: pattern.theme,
          thumbnailUrl: pattern.thumbnailUrl,
          isActive: true
        })
        .onConflictDoNothing()
        .returning();
      
      if (insertedPattern) {
        // Create store item for the pattern
        const isWallPattern = pattern.surfaceType === 'background';
        const itemTypeId = isWallPattern ? wallpaperTypeId : flooringTypeId;
        const cost = pattern.theme === 'luxury' ? 150 : 100; // Luxury patterns cost more
        const rarity = pattern.theme === 'luxury' ? 'rare' : 'common';
        
        await db.insert(storeItems)
          .values({
            name: pattern.name,
            description: pattern.description,
            itemTypeId: itemTypeId,
            cost: cost,
            rarity: rarity,
            isActive: true,
            sortOrder: initialPatterns.indexOf(pattern),
            patternId: insertedPattern.id,
            assetType: 'image',
            thumbnailUrl: pattern.thumbnailUrl
          })
          .onConflictDoNothing();
        
        console.log(`  ✅ Added ${pattern.name} to store (${cost} coins)`);
      } else {
        console.log(`  ⏭️  Pattern ${pattern.code} already exists, skipping...`);
      }
    }
    
    console.log('\n✨ Pattern population complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error populating patterns:', error);
    process.exit(1);
  }
}

// Run the script
populatePatterns();