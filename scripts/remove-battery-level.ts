import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function removeBatteryLevel() {
  console.log('Removing battery level from discussions and energy_level tags...');
  
  try {
    // Remove battery_level column from discussions table
    await db.execute(sql`
      ALTER TABLE discussions 
      DROP COLUMN IF EXISTS battery_level
    `);
    console.log('✓ Removed battery_level column from discussions table');

    // Delete all energy_level tags
    await db.execute(sql`
      DELETE FROM tags WHERE category = 'energy_level'
    `);
    console.log('✓ Deleted energy_level tags');

    // Update tag category constraint to remove energy_level
    await db.execute(sql`
      ALTER TABLE tags 
      DROP CONSTRAINT IF EXISTS tags_category_check
    `);
    
    await db.execute(sql`
      ALTER TABLE tags 
      ADD CONSTRAINT tags_category_check 
      CHECK (category IN ('grade', 'animal_mix', 'challenge_type', 'class_dynamic', 'time_of_year'))
    `);
    console.log('✓ Updated tags category constraint');

    console.log('\n✅ Successfully removed all battery/energy level features from the database!');
  } catch (error) {
    console.error('Error removing battery level:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

removeBatteryLevel();