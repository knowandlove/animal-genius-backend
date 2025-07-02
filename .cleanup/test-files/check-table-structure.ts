import { config } from 'dotenv';
import { Pool } from 'pg';

config();

async function checkTableStructure() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Check if assetId column exists
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'store_items'
      AND column_name IN ('id', 'name', 'image_url', 'asset_id', 'assetid')
      ORDER BY ordinal_position;
    `);
    
    console.log('Store Items Table Columns:');
    result.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Also check if we can manually insert with assetId
    console.log('\nTrying manual insert with assetId...');
    const testResult = await pool.query(`
      INSERT INTO store_items (id, name, item_type, cost, rarity, is_active, image_url, asset_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      crypto.randomUUID(), // Use proper UUID
      'Test Item',
      'avatar_hat',
      100,
      'common',
      true,
      'https://example.com/test.png',
      crypto.randomUUID() // Use proper UUID for asset_id
    ]);
    
    console.log('\nManual insert result:');
    console.log('assetId saved?', testResult.rows[0].asset_id);
    console.log('Full row:', testResult.rows[0]);
    
    // Clean up test item
    await pool.query('DELETE FROM store_items WHERE id = $1', [testResult.rows[0].id]);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkTableStructure();
