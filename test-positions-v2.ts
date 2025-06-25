// Test positions using the existing database connection
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
    
    // Query positions
    const result = await db.execute(sql`
      SELECT 
        item_id,
        animal_type,
        position_x,
        position_y,
        scale,
        rotation
      FROM item_animal_positions
      WHERE item_id IN ('explorer', 'safari', 'greenblinds', 'hearts')
      ORDER BY item_id, animal_type
      LIMIT 20
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
      console.log(`\n📦 ${itemId.toUpperCase()}`);
      console.log('=' .repeat(50));
      
      positions.forEach(pos => {
        const scale = pos.scale / 100;
        console.log(`  ${pos.animal_type.padEnd(15)} X:${pos.position_x}% Y:${pos.position_y}% Scale:${pos.scale}→${scale.toFixed(2)} Rot:${pos.rotation}°`);
      });
    });
    
    console.log('\n\n✅ Test complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testPositions();
