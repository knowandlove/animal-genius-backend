// Run this with: npx tsx check-store-items.ts
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { storeItems, assets } from './shared/schema';
import { eq } from 'drizzle-orm';

// Load environment variables
config();

// Create database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1
});

const db = drizzle(pool);

async function checkStoreItems() {
  console.log('\n=== CHECKING STORE ITEMS ===\n');
  console.log('Cloud storage enabled:', process.env.USE_CLOUD_STORAGE);
  console.log('Database URL:', process.env.DATABASE_URL?.substring(0, 30) + '...');
  
  try {
    // Get all store items
    const items = await db.select().from(storeItems).orderBy(storeItems.createdAt);
    
    console.log(`\nFound ${items.length} store items:\n`);
    
    for (const item of items) {
      console.log(`\n--- ${item.name} ---`);
      console.log(`ID: ${item.id}`);
      console.log(`Type: ${item.itemType}`);
      console.log(`Cost: ${item.cost}`);
      console.log(`Active: ${item.isActive}`);
      console.log(`Image URL: ${item.imageUrl || 'NONE'}`);
      console.log(`Asset ID: ${item.assetId || 'NONE'}`);
      console.log(`Legacy Image URL: ${item.legacyImageUrl || 'NONE'}`);
      console.log(`Created: ${item.createdAt}`);
      
      // If has assetId, fetch the asset
      if (item.assetId) {
        const [asset] = await db.select().from(assets).where(eq(assets.id, item.assetId));
        if (asset) {
          console.log(`\n  Asset Details:`);
          console.log(`  - Bucket: ${asset.bucket}`);
          console.log(`  - Path: ${asset.path}`);
          console.log(`  - Type: ${asset.type}`);
          console.log(`  - Full URL: https://zqyvfnbwpagguutzdvpy.supabase.co/storage/v1/object/public/${asset.bucket}/${asset.path}`);
        } else {
          console.log(`\n  ⚠️  Asset ID ${item.assetId} NOT FOUND in assets table!`);
        }
      } else {
        console.log(`\n  ❌ No asset ID - using legacy storage`);
      }
    }
    
    // Summary
    const withAssetId = items.filter(i => i.assetId).length;
    const withoutAssetId = items.filter(i => !i.assetId).length;
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total items: ${items.length}`);
    console.log(`With cloud storage (assetId): ${withAssetId}`);
    console.log(`Without cloud storage: ${withoutAssetId}`);
    
    if (withoutAssetId > 0 && process.env.USE_CLOUD_STORAGE === 'true') {
      console.log(`\n⚠️  WARNING: Cloud storage is enabled but ${withoutAssetId} items don't have assetId!`);
      console.log('These items will show broken images when students try to equip them.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkStoreItems();
