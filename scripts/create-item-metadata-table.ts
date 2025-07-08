import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

async function createTable() {
  try {
    console.log('Creating item_metadata table...');
    
    // Create item_metadata table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS item_metadata (
        item_id UUID PRIMARY KEY,
        item_type VARCHAR(50) NOT NULL,
        natural_width INTEGER,
        natural_height INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Table created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Failed:', error);
    process.exit(1);
  }
}

createTable();