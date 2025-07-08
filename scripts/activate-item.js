import('dotenv/config');
import pg from 'pg';
const { Pool } = pg;

async function activateItem(itemId) {
  console.log(`🔧 Activating item: ${itemId}\n`);
  
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // First check if item exists
    const checkResult = await pool.query(
      'SELECT id, name, is_active FROM store_items WHERE id = $1',
      [itemId]
    );
    
    if (checkResult.rows.length === 0) {
      console.log('❌ Item not found!');
      return;
    }
    
    const item = checkResult.rows[0];
    console.log(`Found item: ${item.name}`);
    console.log(`Current status: ${item.is_active ? 'Active' : 'Inactive'}`);
    
    if (item.is_active) {
      console.log('✅ Item is already active!');
      return;
    }
    
    // Update item to be active
    const updateResult = await pool.query(
      'UPDATE store_items SET is_active = true WHERE id = $1 RETURNING *',
      [itemId]
    );
    
    if (updateResult.rows.length > 0) {
      console.log('\n✅ Item activated successfully!');
      console.log(`Item: ${updateResult.rows[0].name}`);
      console.log(`Active: ${updateResult.rows[0].is_active}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

// Get item ID from command line
const itemId = process.argv[2];
if (!itemId) {
  console.log('Usage: node scripts/activate-item.js ITEM_ID');
  console.log('Example: node scripts/activate-item.js 0197ddb5-76a6-7277-bd1c-2cd5de9016ac');
  process.exit(1);
}

activateItem(itemId);