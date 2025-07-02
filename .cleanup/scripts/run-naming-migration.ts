import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function runNamingMigration() {
  console.log('Starting naming convention migration...');
  
  try {
    // Start a transaction
    await db.transaction(async (tx) => {
      // 1. Rename passport_code to class_code in classes table
      console.log('Renaming passport_code to class_code in classes table...');
      await tx.execute(sql`ALTER TABLE classes RENAME COLUMN passport_code TO class_code`);
      
      // 2. Rename animal_genius to genius_type in students table
      console.log('Renaming animal_genius to genius_type in students table...');
      await tx.execute(sql`ALTER TABLE students RENAME COLUMN animal_genius TO genius_type`);
      
      // 3. Drop old index if exists
      console.log('Updating indexes...');
      await tx.execute(sql`DROP INDEX IF EXISTS idx_classes_passport_code`);
      
      // 4. Create new index
      await tx.execute(sql`CREATE INDEX IF NOT EXISTS idx_classes_class_code ON classes(class_code)`);
      
      console.log('Migration completed successfully!');
    });
    
    // Verify the changes
    console.log('\nVerifying changes...');
    
    // Check classes table
    const classesInfo = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'classes' 
      AND column_name IN ('passport_code', 'class_code')
    `);
    
    console.log('Classes table columns:', classesInfo.rows);
    
    // Check students table
    const studentsInfo = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'students' 
      AND column_name IN ('animal_genius', 'genius_type')
    `);
    
    console.log('Students table columns:', studentsInfo.rows);
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

runNamingMigration();