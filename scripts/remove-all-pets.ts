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

async function removeAllPets() {
  try {
    console.log('🧹 Removing all pet data...');
    
    // First, count how many pets exist
    const countResult = await pool.query('SELECT COUNT(*) FROM student_pets');
    const petCount = parseInt(countResult.rows[0].count);
    
    console.log(`📊 Found ${petCount} pets in the database`);
    
    if (petCount === 0) {
      console.log('✅ No pets to remove!');
      return;
    }
    
    // Remove all pet interactions first (due to foreign key constraints)
    const interactionsResult = await pool.query('DELETE FROM pet_interactions');
    console.log(`🗑️  Removed ${interactionsResult.rowCount} pet interactions`);
    
    // Remove all student pets
    const petsResult = await pool.query('DELETE FROM student_pets');
    console.log(`🗑️  Removed ${petsResult.rowCount} student pets`);
    
    // Optional: Remove the pet types from catalog (commented out by default)
    // Uncomment if you want to completely reset the pet system
    /*
    const catalogResult = await pool.query('DELETE FROM pets');
    console.log(`🗑️  Removed ${catalogResult.rowCount} pet types from catalog`);
    */
    
    console.log('✅ All pet data has been removed!');
    console.log('');
    console.log('Note: Students can now purchase fishbowls from the store.');
    console.log('Each fishbowl purchase will create a new fish pet automatically.');
    
  } catch (error) {
    console.error('❌ Error removing pets:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Add confirmation prompt
console.log('⚠️  WARNING: This will remove ALL pet data from the database!');
console.log('This includes all student pets and their interaction history.');
console.log('');
console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');

setTimeout(() => {
  removeAllPets();
}, 5000);