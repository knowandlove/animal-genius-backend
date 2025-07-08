import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

async function createTable() {
  try {
    console.log('Creating item_positions_normalized table...');
    
    // Create item_positions_normalized table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS item_positions_normalized (
        item_id UUID NOT NULL,
        animal_type VARCHAR(50) NOT NULL,
        position_x FLOAT NOT NULL CHECK (position_x >= 0 AND position_x <= 1),
        position_y FLOAT NOT NULL CHECK (position_y >= 0 AND position_y <= 1),
        scale FLOAT NOT NULL DEFAULT 1 CHECK (scale > 0 AND scale <= 2),
        rotation FLOAT NOT NULL DEFAULT 0 CHECK (rotation >= -180 AND rotation <= 180),
        anchor_x FLOAT NOT NULL DEFAULT 0.5 CHECK (anchor_x >= 0 AND anchor_x <= 1),
        anchor_y FLOAT NOT NULL DEFAULT 0.5 CHECK (anchor_y >= 0 AND anchor_y <= 1),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (item_id, animal_type)
      )
    `);
    
    console.log('Creating indexes...');
    
    // Create indexes
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_item_positions_normalized_item_id ON item_positions_normalized(item_id)
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_item_positions_normalized_animal_type ON item_positions_normalized(animal_type)
    `);
    
    console.log('Table created successfully!');
    
    // Test the endpoint
    console.log('Testing endpoint...');
    const result = await db.execute(sql`
      SELECT COUNT(*) as count FROM item_positions_normalized
    `);
    console.log('Table has', result.rows[0].count, 'rows');
    
    process.exit(0);
  } catch (error) {
    console.error('Failed:', error);
    process.exit(1);
  }
}

createTable();