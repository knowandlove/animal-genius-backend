// Import dotenv to load environment variables
import { config } from 'dotenv';
config();

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

// Use same SSL config as db.ts
const sslConfig = process.env.NODE_ENV === 'production' 
  ? {
      rejectUnauthorized: true,
    }
  : process.env.DATABASE_URL?.includes('supabase.co')
    ? {
        rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0'
      }
    : false;

// Create pool with SSL configuration
const pool = new Pool({ 
  connectionString: DATABASE_URL,
  ssl: sslConfig,
  max: 1
});

async function addVariantDataColumn() {
  try {
    console.log('🐟 Adding variant_data column to student_pets table...');
    
    // Check if column already exists
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'student_pets' 
      AND column_name = 'variant_data';
    `;
    
    const result = await pool.query(checkQuery);
    
    if (result.rows.length > 0) {
      console.log('✅ variant_data column already exists!');
      return;
    }
    
    // Add the column
    await pool.query(`
      ALTER TABLE student_pets 
      ADD COLUMN variant_data JSONB DEFAULT '{}';
    `);
    
    console.log('✅ variant_data column added successfully!');
    
  } catch (error) {
    console.error('❌ Error adding variant_data column:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

addVariantDataColumn();