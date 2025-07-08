// Import dotenv to load environment variables
import { config } from 'dotenv';
config();

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { storeItems, itemTypes } from '../shared/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

// Use same SSL config as db.ts
const sslConfig = process.env.NODE_ENV === 'production' 
  ? {
      rejectUnauthorized: true,
    }
  : process.env.DATABASE_URL?.includes('supabase.co')
    ? {
        rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0'
      }
    : false;

// Create pool with SSL configuration
const pool = new Pool({ 
  connectionString: DATABASE_URL,
  ssl: sslConfig,
  max: 1
});

const db = drizzle(pool);

async function addFishbowlItem() {
  try {
    console.log('🐠 Checking for furniture item type...');
    
    // First, find or create a furniture item type
    let [furnitureType] = await db
      .select()
      .from(itemTypes)
      .where(eq(itemTypes.code, 'furniture'));
    
    if (!furnitureType) {
      console.log('📦 Creating furniture item type...');
      const furnitureTypeId = uuidv4();
      await db.insert(itemTypes).values({
        id: furnitureTypeId,
        code: 'furniture',
        name: 'Furniture',
        category: 'room_decoration',
        description: 'Furniture and decorative items for rooms'
      });
      furnitureType = { id: furnitureTypeId };
    }
    
    console.log('🐠 Checking for existing fishbowl...');
    
    // Check if fishbowl already exists by name
    const existing = await db
      .select()
      .from(storeItems)
      .where(eq(storeItems.name, 'Fish Bowl'));
    
    if (existing.length > 0) {
      console.log('✅ Fishbowl already exists in store!');
      console.log('   ID:', existing[0].id);
      console.log('   Name:', existing[0].name);
      console.log('   Cost:', existing[0].cost);
      console.log('   Active:', existing[0].isActive);
      await pool.end();
      process.exit(0);
      return;
    }
    
    console.log('🐠 Adding fishbowl to store...');
    
    const fishbowlId = uuidv4();
    
    await db.insert(storeItems).values({
      id: fishbowlId,
      itemTypeId: furnitureType.id,
      name: 'Fish Bowl',
      description: 'A cozy home for your aquatic friend! Comes with a random fish.',
      cost: 200,
      rarity: 'common',
      isActive: true,
      sortOrder: 1000, // Show early in the store
    });
    
    console.log('✅ Fishbowl added to store!');
    console.log('   ID:', fishbowlId);
    console.log('   Cost: 200 coins');
    console.log('   Item Type:', furnitureType.id);
    
  } catch (error) {
    console.error('❌ Error adding fishbowl:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

addFishbowlItem();