import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkDatabase() {
  console.log("🔍 Checking database structure...\n");

  try {
    // Check store_items columns
    const storeColumns = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'store_items' 
      ORDER BY ordinal_position
    `);
    
    console.log("📋 Store Items Columns:");
    console.table(storeColumns.rows);

    // Check if item_types table exists
    const itemTypesExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'item_types'
      )
    `);
    console.log("\n📦 Item Types Table Exists:", itemTypesExists.rows[0].exists);

    // Check item_animal_positions columns
    const positionColumns = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'item_animal_positions' 
      ORDER BY ordinal_position
    `);
    
    console.log("\n🎯 Item Animal Positions Columns:");
    console.table(positionColumns.rows);

    // Sample store item to see structure
    const sampleItems = await db.execute(sql`
      SELECT * FROM store_items LIMIT 1
    `);
    if (sampleItems.rows.length > 0) {
      console.log("\n📦 Sample store item:");
      console.log(JSON.stringify(sampleItems.rows[0], null, 2));
    }

    // Check if we have item types
    const itemTypesCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM item_types
    `);
    console.log("\n📊 Item types count:", itemTypesCount.rows[0].count);
    
  } catch (error) {
    console.error("Error checking database:", error);
  } finally {
    await db.$pool.end();
    process.exit(0);
  }
}

checkDatabase();
