import { config } from 'dotenv';
import { Pool } from 'pg';

config();

async function checkAssets() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Check the most recent assets
    const result = await pool.query(`
      SELECT id, type, category, name, bucket, path, created_at
      FROM assets
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log('Most recent assets:');
    result.rows.forEach(row => {
      console.log(`\n${row.name} (${row.id})`);
      console.log(`  Type: ${row.type}`);
      console.log(`  Category: ${row.category}`);
      console.log(`  Bucket: ${row.bucket}`);
      console.log(`  Path: ${row.path}`);
      console.log(`  Created: ${row.created_at}`);
    });
    
    // Check specific asset from your last upload
    const assetId = '3e4cfcb8-0fe8-4953-aec9-70d96ff8cca6';
    const specific = await pool.query('SELECT * FROM assets WHERE id = $1', [assetId]);
    
    console.log('\n\nChecking for specific asset:', assetId);
    if (specific.rows.length > 0) {
      console.log('✅ Asset exists!');
      console.log(specific.rows[0]);
    } else {
      console.log('❌ Asset NOT found!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkAssets();
