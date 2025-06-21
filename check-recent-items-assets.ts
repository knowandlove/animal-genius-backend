import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { storeItems, assets } from './shared/schema';
import { desc } from 'drizzle-orm';

config();

async function checkRecentItemsAndAssets() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log('=== CHECKING RECENT STORE ITEMS AND ASSETS ===\n');
  
  // Get the 5 most recent store items
  const recentItems = await db.select()
    .from(storeItems)
    .orderBy(desc(storeItems.createdAt))
    .limit(5);
  
  console.log(`Most recent ${recentItems.length} store items:\n`);
  
  for (const item of recentItems) {
    console.log(`📦 ${item.name} (${item.id})`);
    console.log(`   Created: ${item.createdAt}`);
    console.log(`   Type: ${item.itemType}`);
    console.log(`   Image URL: ${item.imageUrl || 'NONE'}`);
    console.log(`   Asset ID: ${item.assetId || 'NONE'}`);
    
    // If it has a Supabase URL but no assetId, that's our problem
    if (item.imageUrl?.includes('supabase.co') && !item.assetId) {
      console.log(`   ⚠️  HAS SUPABASE URL BUT NO ASSET ID!`);
    }
    
    console.log('');
  }
  
  // Also check the assets table
  console.log('\n=== CHECKING ASSETS TABLE ===\n');
  const recentAssets = await db.select()
    .from(assets)
    .orderBy(desc(assets.createdAt))
    .limit(5);
    
  console.log(`Found ${recentAssets.length} recent assets:\n`);
  
  for (const asset of recentAssets) {
    console.log(`🖼️  Asset ID: ${asset.id}`);
    console.log(`   Bucket: ${asset.bucket}`);
    console.log(`   Path: ${asset.path}`);
    console.log(`   Type: ${asset.type}`);
    console.log(`   Created: ${asset.createdAt}`);
    console.log('');
  }
  
  await pool.end();
}

checkRecentItemsAndAssets();
