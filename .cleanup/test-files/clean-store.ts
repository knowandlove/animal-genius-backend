import { config } from 'dotenv';
import { Pool } from 'pg';

config();

async function cleanStoreData() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🧹 Cleaning store data...\n');
    
    // Delete all store items
    const result = await pool.query('DELETE FROM store_items');
    console.log(`✅ Deleted ${result.rowCount} store items`);
    
    // Optional: Also clean up orphaned assets
    const assetsResult = await pool.query(`
      DELETE FROM assets 
      WHERE type = 'item' 
      AND id NOT IN (SELECT asset_id FROM store_items WHERE asset_id IS NOT NULL)
    `);
    console.log(`✅ Deleted ${assetsResult.rowCount} orphaned assets`);
    
    console.log('\n🎉 Store data cleaned! Ready for fresh start.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

cleanStoreData();
