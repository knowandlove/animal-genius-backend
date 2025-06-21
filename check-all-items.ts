import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { storeItems } from './shared/schema';
import { eq } from 'drizzle-orm';

config();

async function checkStoreItems() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log('=== ALL STORE ITEMS ===\n');
  
  const items = await db.select().from(storeItems).orderBy(storeItems.createdAt);
  
  console.log(`Found ${items.length} items in store:\n`);
  
  items.forEach(item => {
    console.log(`${item.name} (${item.id})`);
    console.log(`  Type: ${item.itemType}`);
    console.log(`  Active: ${item.isActive}`);
    console.log(`  Image URL: ${item.imageUrl || 'NONE'}`);
    console.log(`  Asset ID: ${item.assetId || 'NONE'}`);
    console.log(`  Created: ${item.createdAt}`);
    console.log('');
  });
  
  await pool.end();
}

checkStoreItems();
