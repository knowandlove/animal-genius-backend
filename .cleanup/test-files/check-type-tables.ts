import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function checkTypeTables() {
  console.log('Checking animal_types and genius_types tables...\n');
  
  try {
    // Check animal_types structure
    console.log('=== ANIMAL_TYPES TABLE ===');
    const animalTypesColumns = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'animal_types'
      ORDER BY ordinal_position
    `);
    console.log('Columns:', animalTypesColumns.rows);
    
    // Sample animal types
    const animalTypes = await db.execute(sql`
      SELECT * FROM animal_types LIMIT 10
    `);
    console.log('\nSample data:', animalTypes.rows);
    
    // Check genius_types structure
    console.log('\n=== GENIUS_TYPES TABLE ===');
    const geniusTypesColumns = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'genius_types'
      ORDER BY ordinal_position
    `);
    console.log('Columns:', geniusTypesColumns.rows);
    
    // Sample genius types
    const geniusTypes = await db.execute(sql`
      SELECT * FROM genius_types LIMIT 10
    `);
    console.log('\nSample data:', geniusTypes.rows);
    
    // Check how quiz_submissions relates to these
    console.log('\n=== QUIZ_SUBMISSIONS STRUCTURE ===');
    const quizColumns = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'quiz_submissions'
      AND column_name IN ('animal_type', 'genius_type', 'animal_type_id', 'genius_type_id')
      ORDER BY ordinal_position
    `);
    console.log('Relevant columns:', quizColumns.rows);
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

checkTypeTables();