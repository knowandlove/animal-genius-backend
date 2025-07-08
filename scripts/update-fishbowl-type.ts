// Import dotenv to load environment variables
import { config } from 'dotenv';
config();

import { Pool } from 'pg';

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

async function updateFishbowlType() {
  try {
    console.log('🐠 Updating fishbowl item type...');
    
    // First, get the furniture item type ID
    const itemTypeResult = await pool.query(`
      SELECT id FROM item_types WHERE code = 'furniture'
    `);
    
    if (itemTypeResult.rows.length === 0) {
      console.error('❌ Furniture item type not found!');
      return;
    }
    
    const furnitureTypeId = itemTypeResult.rows[0].id;
    console.log('📦 Found furniture type:', furnitureTypeId);
    
    // Update the fishbowl to ensure it's properly set as furniture
    const updateResult = await pool.query(`
      UPDATE store_items 
      SET 
        item_type_id = $1,
        asset_type = 'image',
        updated_at = NOW()
      WHERE name = 'Fish Bowl'
      RETURNING id, name, cost, is_active
    `, [furnitureTypeId]);
    
    if (updateResult.rows.length > 0) {
      console.log('✅ Fishbowl updated successfully!');
      console.log('   ID:', updateResult.rows[0].id);
      console.log('   Name:', updateResult.rows[0].name);
      console.log('   Cost:', updateResult.rows[0].cost);
      console.log('   Active:', updateResult.rows[0].is_active);
    } else {
      console.log('⚠️  No fishbowl found to update');
    }
    
  } catch (error) {
    console.error('❌ Error updating fishbowl:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

updateFishbowlType();