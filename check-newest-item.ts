import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { storeItems } from './shared/schema';
import { desc } from 'drizzle-orm';

config();

async function checkNewestItem() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log('=== NEWEST STORE ITEM ===\n');
  
  const items = await db.select()
    .from(storeItems)
    .orderBy(desc(storeItems.createdAt))
    .limit(1);
  
  if (items.length > 0) {
    const item = items[0];
    console.log(`${item.name} (${item.id})`);
    console.log(`  Type: ${item.itemType}`);
    console.log(`  Active: ${item.isActive}`);
    console.log(`  Image URL: ${item.imageUrl || 'NONE'}`);
    console.log(`  Asset ID: ${item.assetId || 'NONE'}`);
    console.log(`  Created: ${item.createdAt}`);
    
    if (item.assetId) {
      console.log('\n✅ SUCCESS! This item has an assetId!');
      console.log('It should load from Supabase when equipped!');
    } else {
      console.log('\n❌ WARNING: No assetId found');
    }
  }
  
  await pool.end();
}

checkNewestItem();
