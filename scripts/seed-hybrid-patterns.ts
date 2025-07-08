import { db } from '../server/db';
import { patterns } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function seedHybridPatterns() {
  console.log('🌟 Seeding hybrid patterns (CSS + Image)...\n');

  const hybridPatterns = [
    // CSS-based patterns (basic tier)
    {
      code: 'css-stripes-basic',
      name: 'Basic Stripes',
      description: 'Simple striped pattern',
      surfaceType: 'background',
      patternType: 'css' as const,
      patternValue: 'repeating-linear-gradient(45deg, #e0e0e0, #e0e0e0 10px, #f0f0f0 10px, #f0f0f0 20px)',
      theme: 'modern',
      thumbnailUrl: null,
      isActive: true,
    },
    {
      code: 'css-dots-simple',
      name: 'Polka Dots',
      description: 'Playful dots pattern',
      surfaceType: 'background',
      patternType: 'css' as const,
      patternValue: 'radial-gradient(circle at 20px 20px, #d0d0d0 3px, transparent 3px)',
      theme: 'playful',
      thumbnailUrl: null,
      isActive: true,
    },
    {
      code: 'css-checkers-floor',
      name: 'Checkerboard',
      description: 'Classic checkered floor',
      surfaceType: 'texture',
      patternType: 'css' as const,
      patternValue: 'repeating-conic-gradient(#000 0deg 90deg, #fff 90deg 180deg)',
      theme: 'classic',
      thumbnailUrl: null,
      isActive: true,
    },
    
    // Image-based patterns (premium tier)
    {
      code: 'img-wood-oak',
      name: 'Oak Wood Flooring',
      description: 'Realistic oak wood texture',
      surfaceType: 'texture',
      patternType: 'image' as const,
      patternValue: 'https://zqyvfnbwpagguutzdvpy.supabase.co/storage/v1/object/public/patterns/floors/oak-wood.png',
      theme: 'natural',
      thumbnailUrl: 'https://zqyvfnbwpagguutzdvpy.supabase.co/storage/v1/object/public/patterns/floors/oak-wood-thumb.png',
      isActive: true,
    },
    {
      code: 'img-marble-white',
      name: 'White Marble',
      description: 'Elegant marble with gray veins',
      surfaceType: 'texture',
      patternType: 'image' as const,
      patternValue: 'https://zqyvfnbwpagguutzdvpy.supabase.co/storage/v1/object/public/patterns/floors/white-marble.png',
      theme: 'luxury',
      thumbnailUrl: 'https://zqyvfnbwpagguutzdvpy.supabase.co/storage/v1/object/public/patterns/floors/white-marble-thumb.png',
      isActive: true,
    },
    {
      code: 'img-galaxy-wall',
      name: 'Galaxy Dreams',
      description: 'Sparkly night sky with stars',
      surfaceType: 'background',
      patternType: 'image' as const,
      patternValue: 'https://zqyvfnbwpagguutzdvpy.supabase.co/storage/v1/object/public/patterns/walls/galaxy.png',
      theme: 'fantasy',
      thumbnailUrl: 'https://zqyvfnbwpagguutzdvpy.supabase.co/storage/v1/object/public/patterns/walls/galaxy-thumb.png',
      isActive: true,
    },
    {
      code: 'img-floral-vintage',
      name: 'Vintage Flowers',
      description: 'Beautiful floral wallpaper',
      surfaceType: 'background',
      patternType: 'image' as const,
      patternValue: 'https://zqyvfnbwpagguutzdvpy.supabase.co/storage/v1/object/public/patterns/walls/vintage-floral.png',
      theme: 'vintage',
      thumbnailUrl: 'https://zqyvfnbwpagguutzdvpy.supabase.co/storage/v1/object/public/patterns/walls/vintage-floral-thumb.png',
      isActive: true,
    },
  ];

  for (const pattern of hybridPatterns) {
    try {
      // Check if pattern already exists
      const existing = await db
        .select()
        .from(patterns)
        .where(eq(patterns.code, pattern.code))
        .limit(1);

      if (existing.length > 0) {
        console.log(`⏭️  Pattern "${pattern.name}" already exists`);
      } else {
        await db.insert(patterns).values(pattern);
        console.log(`✅ Created ${pattern.patternType} pattern: ${pattern.name}`);
      }
    } catch (error) {
      console.error(`❌ Error creating pattern "${pattern.name}":`, error);
    }
  }

  console.log('\n✨ Hybrid pattern seeding completed!');
  console.log('Note: Image patterns reference placeholder URLs - you\'ll need to upload actual textures');
  process.exit(0);
}

seedHybridPatterns().catch(error => {
  console.error('Failed to seed patterns:', error);
  process.exit(1);
});