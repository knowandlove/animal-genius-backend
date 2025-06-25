// Simple test to check avatar positions
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

// Load environment variables
config();

async function testPositions() {
  console.log('🔍 Testing Avatar Positioning System\n');
  
  // Create database connection
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);
  
  try {
    // Query positions directly
    const result = await sql`
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
    `;
    
    console.log(`Found ${result.length} position records:\n`);
    
    // Group by item
    const byItem: Record<string, any[]> = {};
    result.forEach((row: any) => {
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
    
    // Check for issues
    console.log('\n\n🔎 Checking for potential issues...\n');
    
    const issues = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN position_x < 20 OR position_x > 80 THEN 1 END) as extreme_x,
        COUNT(CASE WHEN position_y < 5 OR position_y > 40 THEN 1 END) as extreme_y,
        COUNT(CASE WHEN scale < 10 OR scale > 100 THEN 1 END) as extreme_scale,
        COUNT(CASE WHEN ABS(rotation) > 45 THEN 1 END) as extreme_rotation
      FROM item_animal_positions
    `;
    
    const issue = issues[0];
    console.log(`Total positions: ${issue.total}`);
    console.log(`Extreme X positions: ${issue.extreme_x}`);
    console.log(`Extreme Y positions: ${issue.extreme_y}`);
    console.log(`Extreme scale values: ${issue.extreme_scale}`);
    console.log(`Extreme rotations: ${issue.extreme_rotation}`);
    
  } catch (error) {
    console.error('Database error:', error);
  }
  
  console.log('\n\nDone!');
}

testPositions().catch(console.error);
