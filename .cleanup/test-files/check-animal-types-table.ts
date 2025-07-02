import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function checkAnimalTypesTable() {
  console.log('Checking for animal types in database...\n');
  
  try {
    // Check if there are any tables that might store animal types
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (
        table_name LIKE '%animal%' 
        OR table_name LIKE '%genius%' 
        OR table_name LIKE '%type%'
        OR table_name = 'assets'
      )
      ORDER BY table_name
    `);
    
    console.log('Found tables:', tables.rows);
    
    // Check assets table structure (mentioned in schema)
    console.log('\n=== ASSETS TABLE STRUCTURE ===');
    const assetsColumns = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'assets'
      ORDER BY ordinal_position
    `);
    
    console.log('Assets columns:', assetsColumns.rows);
    
    // Sample some assets to see what's in there
    console.log('\n=== SAMPLE ASSETS ===');
    const sampleAssets = await db.execute(sql`
      SELECT * FROM assets 
      WHERE category IN ('animal_type', 'genius_type', 'animal', 'genius')
      OR file_name LIKE '%animal%'
      OR file_name LIKE '%genius%'
      LIMIT 20
    `);
    
    console.log('Sample assets:', sampleAssets.rows);
    
    // Check how students reference these
    console.log('\n=== SAMPLE STUDENT DATA ===');
    const sampleStudents = await db.execute(sql`
      SELECT 
        s.id,
        s.student_name,
        s.animal_type_id,
        s.genius_type_id,
        a1.file_name as animal_file,
        a1.category as animal_category,
        a2.file_name as genius_file,
        a2.category as genius_category
      FROM students s
      LEFT JOIN assets a1 ON s.animal_type_id = a1.id
      LEFT JOIN assets a2 ON s.genius_type_id = a2.id
      LIMIT 5
    `);
    
    console.log('Sample students with asset joins:', sampleStudents.rows);
    
  } catch (error) {
    console.error('Error checking tables:', error);
  }
  
  process.exit(0);
}

checkAnimalTypesTable();