// Test positions - check item IDs first
import { config } from 'dotenv';
config();

async function testPositions() {
  console.log('🔍 Testing Avatar Positioning System\n');
  
  try {
    // Import the database connection after config is loaded
    const { db } = await import('./server/db.js');
    const { sql } = await import('drizzle-orm');
    
    // Test connection
    await db.execute(sql`SELECT 1`);
    console.log('✅ Database connection successful\n');
    
    // First, let's see what items exist in the positions table
    console.log('Checking available items in positions table...\n');
    const itemsResult = await db.execute(sql`
      SELECT DISTINCT item_id 
      FROM item_animal_positions 
      LIMIT 10
    `);
    
    console.log('Item IDs found:');
    itemsResult.rows.forEach((row: any) => {
      console.log(`  - ${row.item_id}`);
    });
    
    // Now let's get some actual position data
    console.log('\n\nGetting position data for all items...\n');
    const result = await db.execute(sql`
      SELECT 
        item_id,
        animal_type,
        position_x,
        position_y,
        scale,
        rotation
      FROM item_animal_positions
      ORDER BY item_id, animal_type
      LIMIT 30
    `);
    
    console.log(`Found ${result.rows.length} position records:\n`);
    
    // Group by item
    const byItem: Record<string, any[]> = {};
    result.rows.forEach((row: any) => {
      if (!byItem[row.item_id]) {
        byItem[row.item_id] = [];
      }
      byItem[row.item_id].push(row);
    });
    
    // Display results
    Object.entries(byItem).forEach(([itemId, positions]) => {
      console.log(`\n📦 Item ID: ${itemId}`);
      console.log('=' .repeat(50));
      
      positions.forEach(pos => {
        const scale = pos.scale / 100;
        console.log(`  ${pos.animal_type.padEnd(15)} X:${pos.position_x}% Y:${pos.position_y}% Scale:${pos.scale}→${scale.toFixed(2)} Rot:${pos.rotation}°`);
      });
    });
    
    // Also check store items to see the mapping
    console.log('\n\nChecking store items...\n');
    const storeResult = await db.execute(sql`
      SELECT id, name, item_type
      FROM store_items
      WHERE item_type LIKE 'avatar%'
      LIMIT 10
    `);
    
    console.log('Store items:');
    storeResult.rows.forEach((row: any) => {
      console.log(`  - ${row.id} = ${row.name} (${row.item_type})`);
    });
    
    console.log('\n\n✅ Test complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testPositions();
