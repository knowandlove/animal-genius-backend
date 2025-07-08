import('dotenv/config');
import pg from 'pg';
const { Pool } = pg;

async function checkItemStatus(itemId) {
  console.log(`🔍 Checking item status for ID: ${itemId}\n`);
  
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Find the item
    const itemResult = await pool.query(
      `SELECT 
        id,
        name,
        is_active,
        cost,
        pattern_id,
        item_type_id,
        created_at,
        updated_at
      FROM store_items 
      WHERE id = $1`,
      [itemId]
    );
    
    if (itemResult.rows.length === 0) {
      console.log('❌ Item not found in database!');
      console.log('\nThis item ID does not exist. It may have been deleted.');
      return;
    }
    
    const item = itemResult.rows[0];
    
    console.log('✅ Item found:');
    console.log(`   Name: ${item.name}`);
    console.log(`   Active: ${item.is_active ? '✅ YES' : '❌ NO'}`);
    console.log(`   Cost: ${item.cost} coins`);
    console.log(`   Has Pattern: ${item.pattern_id ? '✅' : '❌'}`);
    console.log(`   Created: ${item.created_at}`);
    console.log(`   Updated: ${item.updated_at}`);
    
    if (!item.is_active) {
      console.log('\n⚠️  ISSUE: This item is INACTIVE!');
      console.log('   The item exists but is_active=false, which is why purchase fails.');
      console.log('\n🔧 To fix: Set is_active=true in the admin panel or database.');
    }
    
    // Check if it's a pattern item
    if (item.pattern_id) {
      const patternResult = await pool.query(
        'SELECT * FROM patterns WHERE id = $1',
        [item.pattern_id]
      );
      
      if (patternResult.rows.length > 0) {
        const pattern = patternResult.rows[0];
        console.log('\n📋 Linked Pattern:');
        console.log(`   Code: ${pattern.code}`);
        console.log(`   Name: ${pattern.name}`);
        console.log(`   Type: ${pattern.pattern_type}`);
        console.log(`   Active: ${pattern.is_active ? '✅' : '❌'}`);
      }
    }
    
    // Get item type
    const typeResult = await pool.query(
      'SELECT * FROM item_types WHERE id = $1',
      [item.item_type_id]
    );
    
    if (typeResult.rows.length > 0) {
      const itemType = typeResult.rows[0];
      console.log(`\n📦 Item Type: ${itemType.code} (${itemType.category})`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Get item ID from command line
const itemId = process.argv[2];
if (!itemId) {
  console.log('Usage: node scripts/check-item-quick.js ITEM_ID');
  console.log('Example: node scripts/check-item-quick.js 0197ddb5-76a6-7277-bd1c-2cd5de9016ac');
  process.exit(1);
}

checkItemStatus(itemId);