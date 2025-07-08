import { db } from '../server/db';
import { patterns } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function updatePatternValues() {
  console.log('🎨 Updating pattern values for existing patterns...\n');

  const patternUpdates = [
    {
      code: 'brick_red_01',
      patternValue: `repeating-linear-gradient(
        0deg,
        #8B4513,
        #8B4513 20px,
        #A0522D 20px,
        #A0522D 22px
      ),
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 50px,
        rgba(0,0,0,0.1) 50px,
        rgba(0,0,0,0.1) 52px
      )`
    },
    {
      code: 'wallpaper_stripes_01',
      patternValue: `repeating-linear-gradient(
        90deg,
        #FFE4E1,
        #FFE4E1 20px,
        #E6E6FA 20px,
        #E6E6FA 40px
      )`
    },
    {
      code: 'tile_checkered_01',
      patternValue: `linear-gradient(45deg, #000 25%, transparent 25%),
      linear-gradient(-45deg, #000 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #000 75%),
      linear-gradient(-45deg, transparent 75%, #000 75%)`
    },
    {
      code: 'wood_oak_01',
      patternValue: `repeating-linear-gradient(
        90deg,
        #8B4513,
        #8B4513 5px,
        #A0522D 5px,
        #A0522D 10px
      )`
    },
    {
      code: 'grass_green_01',
      patternValue: `repeating-linear-gradient(
        75deg,
        #228B22,
        #228B22 2px,
        #32CD32 2px,
        #32CD32 4px
      )`
    },
    {
      code: 'wallpaper_floral_01',
      patternValue: `radial-gradient(circle at 20% 20%, #FF69B4 0%, transparent 30%),
      radial-gradient(circle at 60% 60%, #FF1493 0%, transparent 25%),
      radial-gradient(circle at 80% 20%, #FFB6C1 0%, transparent 20%)`
    },
    {
      code: 'stone_gray_01',
      patternValue: `repeating-conic-gradient(from 45deg at 30% 30%, #696969 0deg, #708090 90deg, #778899 180deg, #708090 270deg, #696969 360deg)`
    },
    {
      code: 'wallpaper_stars_01',
      patternValue: `radial-gradient(circle at 20% 20%, white 0%, transparent 3%),
      radial-gradient(circle at 60% 10%, white 0%, transparent 2%),
      radial-gradient(circle at 80% 80%, white 0%, transparent 2.5%),
      radial-gradient(circle at 30% 70%, white 0%, transparent 2%),
      radial-gradient(circle at 90% 50%, yellow 0%, transparent 15%)`
    },
    {
      code: 'carpet_blue_01',
      patternValue: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.1) 10px, rgba(255,255,255,.1) 20px),
      repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(0,0,0,.1) 10px, rgba(0,0,0,.1) 20px)`
    },
    {
      code: 'tile_marble_01',
      patternValue: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(128,128,128,.1) 35px, rgba(128,128,128,.1) 70px),
      repeating-linear-gradient(-45deg, transparent, transparent 35px, rgba(128,128,128,.05) 35px, rgba(128,128,128,.05) 70px)`
    }
  ];

  for (const update of patternUpdates) {
    try {
      await db
        .update(patterns)
        .set({ patternValue: update.patternValue })
        .where(eq(patterns.code, update.code));
      
      console.log(`✅ Updated pattern: ${update.code}`);
    } catch (error) {
      console.error(`❌ Error updating pattern "${update.code}":`, error);
    }
  }

  console.log('\n✨ Pattern value updates completed!');
  process.exit(0);
}

updatePatternValues().catch(error => {
  console.error('Failed to update patterns:', error);
  process.exit(1);
});