import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { storeItems, assets } from './shared/schema';
import { eq, and, isNull, like } from 'drizzle-orm';

config();

async function fixExistingStoreItems() {
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
    
    let fixedCount = 0;
    
    for (const item of itemsToFix) {
      console.log(`\n📦 Processing: ${item.name}`);
      console.log(`   Image URL: ${item.imageUrl}`);
      
      // Extract the path from the Supabase URL
      // URL format: https://xxx.supabase.co/storage/v1/object/public/bucket-name/path
      const urlParts = item.imageUrl!.split('/storage/v1/object/public/');
      if (urlParts.length !== 2) {
        console.log('   ❌ Could not parse URL');
        continue;
      }
      
      const pathWithBucket = urlParts[1];
      const [bucket, ...pathParts] = pathWithBucket.split('/');
      const path = pathParts.join('/');
      
      console.log(`   Bucket: ${bucket}`);
      console.log(`   Path: ${path}`);
      
      // Find the matching asset
      const [matchingAsset] = await db.select()
        .from(assets)
        .where(
          and(
            eq(assets.bucket, bucket),
            eq(assets.path, path)
          )
        )
        .limit(1);
      
      if (matchingAsset) {
        console.log(`   ✅ Found matching asset: ${matchingAsset.id}`);
        
        // Update the store item with the assetId
        await db.update(storeItems)
          .set({ 
            assetId: matchingAsset.id,
            updatedAt: new Date()
          })
          .where(eq(storeItems.id, item.id));
        
        console.log(`   ✅ Updated store item with assetId`);
        fixedCount++;
      } else {
        console.log(`   ❌ No matching asset found in database`);
        console.log(`      This shouldn't happen - the asset should exist!`);
      }
    }
    
    console.log(`\n✅ Fixed ${fixedCount} out of ${itemsToFix.length} items`);
    
    // Verify the fix
    console.log('\n=== VERIFICATION ===\n');
    const verifyItems = await db.select()
      .from(storeItems)
      .where(like(storeItems.imageUrl, '%supabase.co%'));
    
    for (const item of verifyItems) {
      console.log(`${item.name}: ${item.assetId ? '✅ Has assetId' : '❌ Missing assetId'}`);
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

fixExistingStoreItems();
