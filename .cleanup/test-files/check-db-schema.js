import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function checkSchema() {
  try {
    console.log('Checking database schema...\n');
    
    // Check classes table
    console.log('=== CLASSES TABLE ===');
    const classesResult = await db.execute(sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'classes' 
      ORDER BY ordinal_position
    `);
    
    classesResult.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type} ${row.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });
    
    console.log('\n=== ITEM_ANIMAL_POSITIONS TABLE ===');
    const positionsResult = await db.execute(sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'item_animal_positions' 
      ORDER BY ordinal_position
    `);
    
    positionsResult.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type} ${row.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });
    
    console.log('\n=== SAMPLE DATA ===');
    const sampleClasses = await db.execute(sql`SELECT id, name, funcode FROM classes LIMIT 3`);
    console.log('Sample classes:', sampleClasses.rows);
    
    const samplePositions = await db.execute(sql`SELECT * FROM item_animal_positions LIMIT 3`);
    console.log('Sample positions:', samplePositions.rows);
    
  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    process.exit(0);
  }
}

checkSchema(); 