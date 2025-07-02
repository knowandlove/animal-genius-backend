// Run this with: npx tsx check-recent-items.ts
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { storeItems, assets } from './shared/schema';
import { eq, desc } from 'drizzle-orm';

// Load environment variables
config();

// Create database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1
});

const db = drizzle(pool);

async function checkRecentItems() {
  console.log('\n=== CHECKING RECENT STORE ITEMS ===\n');
  
  try {
    // Get the 5 most recent items
    const items = await db
      .select()
      .from(storeItems)
      .orderBy(desc(storeItems.createdAt))
      .limit(5);
    
    console.log(`Showing ${items.length} most recent items:\n`);
    
    for (const item of items) {
      console.log(`\n${item.name} (${item.itemType})`);
      console.log(`Created: ${item.createdAt}`);
      console.log(`Image URL: ${item.imageUrl || 'NONE'}`);
      console.log(`Asset ID: ${item.assetId || 'NONE'}`);
      
      if (item.assetId) {
        const [asset] = await db.select().from(assets).where(eq(assets.id, item.assetId));
        if (asset) {
          const fullUrl = `https://zqyvfnbwpagguutzdvpy.supabase.co/storage/v1/object/public/${asset.bucket}/${asset.path}`;
          console.log(`✅ Cloud URL: ${fullUrl}`);
        } else {
          console.log(`❌ Asset ${item.assetId} not found!`);
        }
      } else {
        console.log(`❌ No cloud storage - will use: ${process.env.API_URL || 'http://localhost:5001'}${item.imageUrl}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkRecentItems();
