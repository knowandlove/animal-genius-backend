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

async function setupFishbowlAsPet() {
  try {
    console.log('🐠 Setting up fishbowl in pets category...');
    
    // Start a transaction
    await pool.query('BEGIN');
    
    // 1. First, remove all old pets from the catalog
    console.log('🗑️  Removing old pets from catalog...');
    const deleteResult = await pool.query(`
      DELETE FROM pets 
      WHERE species != 'goldfish'
    `);
    console.log(`   Removed ${deleteResult.rowCount} old pet types`);
    
    // 2. Create or get the pets item type
    let petsTypeId;
    const existingPetsType = await pool.query(`
      SELECT id FROM item_types WHERE code = 'pets'
    `);
    
    if (existingPetsType.rows.length > 0) {
      petsTypeId = existingPetsType.rows[0].id;
      console.log('📦 Found existing pets item type');
    } else {
      console.log('📦 Creating pets item type...');
      const newPetsType = await pool.query(`
        INSERT INTO item_types (code, name, category, description)
        VALUES ('pets', 'Pets', 'pets', 'Pets and pet habitats')
        RETURNING id
      `);
      petsTypeId = newPetsType.rows[0].id;
    }
    
    // 3. Update the fishbowl to be in the pets category
    console.log('🐠 Moving fishbowl to pets category...');
    const updateResult = await pool.query(`
      UPDATE store_items 
      SET 
        item_type_id = $1,
        description = 'A beautiful fishbowl habitat for your pet fish. Comes with a random colored fish!',
        sort_order = 100,
        updated_at = NOW()
      WHERE name = 'Fish Bowl'
      RETURNING id, name, cost
    `, [petsTypeId]);
    
    if (updateResult.rows.length > 0) {
      console.log('✅ Fishbowl moved to pets category!');
      console.log('   ID:', updateResult.rows[0].id);
      console.log('   Name:', updateResult.rows[0].name);
      console.log('   Cost:', updateResult.rows[0].cost);
    } else {
      throw new Error('Fishbowl not found in store!');
    }
    
    // 4. Ensure we have the goldfish pet type in the pets catalog
    const existingGoldfish = await pool.query(`
      SELECT id FROM pets WHERE species = 'goldfish'
    `);
    
    if (existingGoldfish.rows.length === 0) {
      console.log('🐟 Creating goldfish pet type...');
      await pool.query(`
        INSERT INTO pets (species, name, description, asset_url, cost, rarity, base_stats, is_active, sort_order)
        VALUES (
          'goldfish',
          'Pet Fish',
          'A friendly fish that lives in a bowl',
          'fishbowl',
          0,
          'common',
          '{"hungerDecayRate": 2, "happinessDecayRate": 3}'::jsonb,
          true,
          100
        )
      `);
      console.log('✅ Goldfish pet type created');
    } else {
      console.log('✅ Goldfish pet type already exists');
    }
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    console.log('\n🎉 Fishbowl setup complete!');
    console.log('   - Old pets removed from catalog');
    console.log('   - Fishbowl moved to pets category');
    console.log('   - Goldfish pet type configured');
    console.log('\nStudents will now see the fishbowl in the Pets section of the store.');
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Error setting up fishbowl:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Run the setup
setupFishbowlAsPet();