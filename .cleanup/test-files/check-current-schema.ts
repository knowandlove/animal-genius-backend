import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function checkCurrentSchema() {
  console.log('Checking current database schema...\n');
  
  try {
    // Check classes table columns
    console.log('=== CLASSES TABLE ===');
    const classesColumns = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'classes'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns:');
    classesColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Check students table columns
    console.log('\n=== STUDENTS TABLE ===');
    const studentsColumns = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'students'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns:');
    studentsColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Check for specific columns
    console.log('\n=== CHECKING SPECIFIC COLUMNS ===');
    
    // Check if passport_code exists in classes
    const hasPassportCode = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'classes' AND column_name = 'passport_code'
      ) as exists
    `);
    console.log('classes.passport_code exists:', hasPassportCode.rows[0].exists);
    
    // Check if class_code exists in classes
    const hasClassCode = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'classes' AND column_name = 'class_code'
      ) as exists
    `);
    console.log('classes.class_code exists:', hasClassCode.rows[0].exists);
    
    // Check if animal_genius exists in students
    const hasAnimalGenius = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'students' AND column_name = 'animal_genius'
      ) as exists
    `);
    console.log('students.animal_genius exists:', hasAnimalGenius.rows[0].exists);
    
    // Check if genius_type exists in students
    const hasGeniusType = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'students' AND column_name = 'genius_type'
      ) as exists
    `);
    console.log('students.genius_type exists:', hasGeniusType.rows[0].exists);
    
  } catch (error) {
    console.error('Error checking schema:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

checkCurrentSchema();