import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { storeItems, assets } from './shared/schema';
import { eq, and, isNull, like } from 'drizzle-orm';

config();

async function fixMissingAssetIds() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log('🔧 Fixing store items with missing assetId values...\n');
  
  try {
    // Find all items with Supabase URLs but no assetId
    const itemsToFix = await db.select()
      .from(storeItems)
      .where(
        and(
          isNull(storeItems.assetId),
          like(storeItems.imageUrl, '%supabase.co%')
        )
      );
    
    console.log(`Found ${itemsToFix.length} items to fix\n`);
    
    for (const item of itemsToFix) {
      console.log