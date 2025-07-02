import { config } from 'dotenv';
import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';

config();

async function runMigration() {
  console.log('🚀 Starting normalized positioning migration...');

  try {
    // Use Drizzle's transaction support
    await db.transaction(async (tx) => {

    // Create animals table
    console.log('Creating animals table...');
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS animals (
        animal_type VARCHAR(255) PRIMARY KEY,
        display_name VARCHAR(255) NOT NULL,
        image_path VARCHAR(255) NOT NULL,
        natural_width INTEGER NOT NULL,
        natural_height INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert animal data
    console.log('Inserting animal data...');
    await tx.execute(sql`
      INSERT INTO animals (animal_type, display_name, image_path, natural_width, natural_height) VALUES
      ('meerkat', 'Meerkat', '/images/meerkat_full.png', 800, 800),
      ('panda', 'Panda', '/images/panda_full.png', 800, 800),
      ('owl', 'Owl', '/images/owl_full.png', 800, 800),
      ('beaver', 'Beaver', '/images/beaver_full.png', 800, 800),
      ('elephant', 'Elephant', '/images/elephant_full.png', 800, 800),
      ('otter', 'Otter', '/images/otter_full.png', 800, 800),
      ('parrot', 'Parrot', '/images/parrot_full.png', 800, 800),
      ('border-collie', 'Border Collie', '/images/border_collie_full.png', 800, 800)
      ON CONFLICT (animal_type) DO NOTHING
    `);

    // Create new item_positions table with normalized coordinates
    console.log('Creating item_positions_normalized table...');
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS item_positions_normalized (
        item_id VARCHAR(255) NOT NULL,
        animal_type VARCHAR(255) NOT NULL,
        position_x DECIMAL(10, 9) NOT NULL,
        position_y DECIMAL(10, 9) NOT NULL,
        scale DECIMAL(10, 9) NOT NULL,
        rotation SMALLINT NOT NULL DEFAULT 0,
        anchor_x DECIMAL(10, 9) NOT NULL DEFAULT 0.5,
        anchor_y DECIMAL(10, 9) NOT NULL DEFAULT 0.5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (item_id, animal_type),
        FOREIGN KEY (animal_type) REFERENCES animals(animal_type)
      )
    `);

    // Create items metadata table
    console.log('Creating item_metadata table...');
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS item_metadata (
        item_id VARCHAR(255) PRIMARY KEY,
        item_type VARCHAR(50) NOT NULL,
        natural_width INTEGER,
        natural_height INTEGER,
        default_anchor_x DECIMAL(10, 9) NOT NULL DEFAULT 0.5,
        default_anchor_y DECIMAL(10, 9) NOT NULL DEFAULT 0.5
      )
    `);

    // Get existing items from store
    console.log('Setting up item metadata...');
    const storeItems = await tx.execute(sql`
      SELECT DISTINCT si.id, it.code as item_type 
      FROM store_items si
      JOIN item_types it ON si.item_type_id = it.id
      WHERE it.code IN ('avatar_hat', 'avatar_glasses', 'avatar_accessory')
    `);

    for (const item of storeItems.rows || storeItems) {
      const anchorY = item.item_type === 'avatar_hat' ? 1.0 : 0.5;
      
      await tx.execute(sql`
        INSERT INTO item_metadata (item_id, item_type, default_anchor_x, default_anchor_y)
        VALUES (${item.id}, ${item.item_type}, ${0.5}, ${anchorY})
        ON CONFLICT (item_id) DO NOTHING
      `);
    }

    // Skip migration of old positions since item_positions table doesn't exist
    console.log('No existing positions to migrate (item_positions table does not exist).');

    // Create indexes
    console.log('Creating indexes...');
    await tx.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_item_positions_normalized_item_id 
      ON item_positions_normalized(item_id)
    `);
    
    await tx.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_item_positions_normalized_animal_type 
      ON item_positions_normalized(animal_type)
    `);
    
    console.log('✅ Migration completed successfully!');
    
    // Show summary
    const summary = await tx.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM animals) as animal_count,
        (SELECT COUNT(*) FROM item_positions_normalized) as position_count,
        (SELECT COUNT(*) FROM item_metadata) as item_count
    `);
    
    console.log('\n📊 Summary:');
    console.log(`- Animals: ${summary.rows[0].animal_count}`);
    console.log(`- Item metadata: ${summary.rows[0].item_count}`);
    console.log(`- Positions migrated: ${summary.rows[0].position_count}`);

    }); // End transaction
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
runMigration().catch(console.error);