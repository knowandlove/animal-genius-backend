import { db } from '../server/db.js';
import { featureFlags } from '../shared/schema-gardens.js';
import { sql } from 'drizzle-orm';

async function enableGardenFlag() {
  try {
    await db
      .insert(featureFlags)
      .values({
        id: 'garden_system',
        isEnabled: true
      })
      .onConflictDoUpdate({
        target: featureFlags.id,
        set: {
          isEnabled: true,
          updatedAt: sql`NOW()`
        }
      });
    
    console.log('✅ Garden system feature flag enabled');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error enabling garden flag:', error);
    process.exit(1);
  }
}

enableGardenFlag();