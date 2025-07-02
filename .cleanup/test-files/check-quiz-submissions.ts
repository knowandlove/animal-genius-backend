import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function checkQuizSubmissions() {
  console.log('Checking quiz_submissions table structure...\n');
  
  try {
    const columns = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'quiz_submissions'
      ORDER BY ordinal_position
    `);
    
    console.log('All columns:', columns.rows);
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

checkQuizSubmissions();