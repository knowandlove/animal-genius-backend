import { config } from 'dotenv';
import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';

config();

async function checkTables() {
  try {
    // Check if animals table exists
    const animalsExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'animals'
      );
    `);
    console.log('Animals table exists:', animalsExists.rows[0].exists);

    // Check if item_positions table exists
    const itemPositionsExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'item_positions'
      );
    `);
    console.log('Item positions table exists:', itemPositionsExists.rows[0].exists);

    // Check if item_positions_normalized exists
    const normalizedExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'item_positions_normalized'
      );
    `);
    console.log('Item positions normalized table exists:', normalizedExists.rows[0].exists);

    // If item_positions exists, check its structure
    if (itemPositionsExists.rows[0].exists) {
      const columns = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'item_positions'
        ORDER BY ordinal_position;
      `);
      console.log('\nItem positions columns:');
      columns.rows.forEach(col => console.log(`- ${col.column_name}: ${col.data_type}`));
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTables();