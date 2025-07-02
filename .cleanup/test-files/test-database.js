import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

async function testDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔍 Testing database connection and tables...\n');

    // Test connection
    const testResult = await pool.query('SELECT 1');
    console.log('✅ Database connection successful');

    // Check if tables exist
    const tablesQuery = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log('\n📋 Tables in database:');
    tablesQuery.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // Check lookup table counts
    console.log('\n📊 Lookup table counts:');
    
    try {
      const animalCount = await pool.query('SELECT COUNT(*) FROM animal_types');
      console.log(`   Animal types: ${animalCount.rows[0].count}`);
    } catch (e) {
      console.log('   ❌ animal_types table error:', e.message);
    }

    try {
      const itemCount = await pool.query('SELECT COUNT(*) FROM item_types');
      console.log(`   Item types: ${itemCount.rows[0].count}`);
    } catch (e) {
      console.log('   ❌ item_types table error:', e.message);
    }

    try {
      const geniusCount = await pool.query('SELECT COUNT(*) FROM genius_types');
      console.log(`   Genius types: ${geniusCount.rows[0].count}`);
    } catch (e) {
      console.log('   ❌ genius_types table error:', e.message);
    }

    try {
      const storeCount = await pool.query('SELECT COUNT(*) FROM store_items');
      console.log(`   Store items: ${storeCount.rows[0].count}`);
    } catch (e) {
      console.log('   ❌ store_items table error:', e.message);
    }

    // Check if profiles exist
    try {
      const profileCount = await pool.query('SELECT COUNT(*) FROM profiles');
      console.log(`   Profiles: ${profileCount.rows[0].count}`);
    } catch (e) {
      console.log('   ❌ profiles table error:', e.message);
    }

  } catch (error) {
    console.error('\n❌ Database test failed:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the test
testDatabase();
