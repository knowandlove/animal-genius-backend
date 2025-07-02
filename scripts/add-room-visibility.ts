import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function addRoomVisibility() {
  try {
    console.log('Adding room_visibility column to students table...');
    
    await db.execute(sql`
      ALTER TABLE students 
      ADD COLUMN IF NOT EXISTS room_visibility VARCHAR(20) DEFAULT 'class'
    `);
    
    console.log('✅ Successfully added room_visibility column');
    process.exit(0);
  } catch (error) {
    console.error('Error adding column:', error);
    process.exit(1);
  }
}

addRoomVisibility();