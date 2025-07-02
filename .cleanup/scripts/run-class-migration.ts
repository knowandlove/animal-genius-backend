import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function runMigration() {
  try {
    console.log("🔧 Running migration to add class customization fields...");
    
    // Add the missing columns
    await db.execute(sql`
      ALTER TABLE classes 
      ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'book',
      ADD COLUMN IF NOT EXISTS background_color VARCHAR(7) DEFAULT '#829B79',
      ADD COLUMN IF NOT EXISTS number_of_students INTEGER
    `);
    
    console.log("✅ Migration completed successfully!");
    console.log("Added fields: icon, background_color, number_of_students");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMigration();
