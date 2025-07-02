import { config } from 'dotenv';
import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';

config();

async function testPosition() {
  try {
    // Get a sample store item
    const storeItems = await db.execute(sql`
      SELECT si.id, it.code as item_type 
      FROM store_items si
      JOIN item_types it ON si.item_type_id = it.id
      WHERE it.code IN ('avatar_hat', 'avatar_glasses', 'avatar_accessory')
      LIMIT 1
    `);
    
    if (storeItems.rows.length === 0) {
      console.log('No avatar items found in store');
      process.exit(1);
    }
    
    const testItem = storeItems.rows[0];
    console.log('Test item:', testItem);
    
    // Insert a test position for meerkat
    const result = await db.execute(sql`
      INSERT INTO item_positions_normalized 
        (item_id, animal_type, position_x, position_y, scale, rotation, anchor_x, anchor_y)
      VALUES 
        (${testItem.id}, 'meerkat', 0.5, 0.2, 0.3, 0, 0.5, 1.0)
      ON CONFLICT (item_id, animal_type) 
      DO UPDATE SET
        position_x = EXCLUDED.position_x,
        position_y = EXCLUDED.position_y,
        scale = EXCLUDED.scale,
        rotation = EXCLUDED.rotation,
        anchor_x = EXCLUDED.anchor_x,
        anchor_y = EXCLUDED.anchor_y,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `);
    
    console.log('Created test position:', result.rows[0]);
    
    // Verify it can be fetched
    const positions = await db.execute(sql`
      SELECT * FROM item_positions_normalized 
      WHERE item_id = ${testItem.id}
    `);
    
    console.log('All positions for this item:', positions.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testPosition();