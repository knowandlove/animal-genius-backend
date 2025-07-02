import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

async function addSampleStoreItems() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🛍️ Adding sample store items...\n');

    // Start a transaction
    await pool.query('BEGIN');

    // First, get the item type IDs we need
    const itemTypesResult = await pool.query(`
      SELECT id, code, category FROM item_types
    `);
    
    const itemTypeMap = new Map();
    itemTypesResult.rows.forEach(row => {
      itemTypeMap.set(row.code, row.id);
    });

    console.log('📋 Found item types:', itemTypesResult.rows.length);

    // Sample store items
    const sampleItems = [
      // Avatar Hats
      {
        name: 'Explorer Hat',
        description: 'A rugged hat for adventurous animals',
        item_type_id: itemTypeMap.get('avatar_hat'),
        cost: 100,
        rarity: 'common',
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Wizard Hat',
        description: 'A magical hat with stars and moons',
        item_type_id: itemTypeMap.get('avatar_hat'),
        cost: 250,
        rarity: 'rare',
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Crown',
        description: 'A golden crown fit for royalty',
        item_type_id: itemTypeMap.get('avatar_hat'),
        cost: 500,
        rarity: 'legendary',
        is_active: true,
        sort_order: 3
      },
      
      // Avatar Glasses
      {
        name: 'Cool Sunglasses',
        description: 'Stylish shades for sunny days',
        item_type_id: itemTypeMap.get('avatar_glasses'),
        cost: 75,
        rarity: 'common',
        is_active: true,
        sort_order: 10
      },
      {
        name: 'Heart Glasses',
        description: 'Rose-tinted glasses shaped like hearts',
        item_type_id: itemTypeMap.get('avatar_glasses'),
        cost: 150,
        rarity: 'rare',
        is_active: true,
        sort_order: 11
      },
      
      // Avatar Accessories
      {
        name: 'Red Bow Tie',
        description: 'A dapper bow tie for formal occasions',
        item_type_id: itemTypeMap.get('avatar_accessory'),
        cost: 50,
        rarity: 'common',
        is_active: true,
        sort_order: 20
      },
      {
        name: 'Pearl Necklace',
        description: 'An elegant string of pearls',
        item_type_id: itemTypeMap.get('avatar_accessory'),
        cost: 200,
        rarity: 'rare',
        is_active: true,
        sort_order: 21
      },
      
      // Room Furniture
      {
        name: 'Cozy Bed',
        description: 'A comfortable bed for sweet dreams',
        item_type_id: itemTypeMap.get('room_furniture'),
        cost: 300,
        rarity: 'common',
        is_active: true,
        sort_order: 30
      },
      {
        name: 'Study Desk',
        description: 'Perfect for homework and creative projects',
        item_type_id: itemTypeMap.get('room_furniture'),
        cost: 250,
        rarity: 'common',
        is_active: true,
        sort_order: 31
      },
      
      // Room Decorations
      {
        name: 'Potted Plant',
        description: 'A lovely green plant to brighten the room',
        item_type_id: itemTypeMap.get('room_decoration'),
        cost: 50,
        rarity: 'common',
        is_active: true,
        sort_order: 40
      },
      {
        name: 'Motivational Poster',
        description: 'Be the best you can be!',
        item_type_id: itemTypeMap.get('room_decoration'),
        cost: 25,
        rarity: 'common',
        is_active: true,
        sort_order: 41
      },
      
      // Room Wallpaper
      {
        name: 'Sky Blue Wallpaper',
        description: 'Peaceful blue walls with fluffy clouds',
        item_type_id: itemTypeMap.get('room_wallpaper'),
        cost: 100,
        rarity: 'common',
        is_active: true,
        sort_order: 50
      },
      {
        name: 'Space Theme Wallpaper',
        description: 'Stars, planets, and galaxies',
        item_type_id: itemTypeMap.get('room_wallpaper'),
        cost: 200,
        rarity: 'rare',
        is_active: true,
        sort_order: 51
      }
    ];

    // Insert store items
    let insertedCount = 0;
    for (const item of sampleItems) {
      if (item.item_type_id) {
        await pool.query(`
          INSERT INTO store_items (name, description, item_type_id, cost, rarity, is_active, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [item.name, item.description, item.item_type_id, item.cost, item.rarity, item.is_active, item.sort_order]);
        insertedCount++;
        console.log(`   ✓ Added: ${item.name}`);
      } else {
        console.log(`   ⚠️  Skipped: ${item.name} (missing item type)`);
      }
    }

    // Commit the transaction
    await pool.query('COMMIT');

    console.log(`\n✅ Successfully added ${insertedCount} store items!`);

  } catch (error) {
    // Rollback on error
    await pool.query('ROLLBACK');
    console.error('\n❌ Error adding store items:', error.message);
  } finally {
    await pool.end();
  }
}

// Run immediately
addSampleStoreItems();
