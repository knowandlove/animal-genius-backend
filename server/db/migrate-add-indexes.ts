import { db } from "../db";
import { sql } from "drizzle-orm";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function addIndexes() {
  try {
    console.log("🚀 Starting database index migration...");
    
    // Read the SQL file
    const sqlContent = readFileSync(join(__dirname, "add-indexes.sql"), "utf-8");
    
    // Split by semicolons and filter out empty statements
    const statements = sqlContent
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("--"));
    
    // Execute each statement
    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      await db.execute(sql.raw(statement));
    }
    
    console.log("✅ All indexes created successfully!");
    console.log("📊 Database performance should now be improved for:");
    console.log("   - User authentication queries");
    console.log("   - Class listing and filtering");
    console.log("   - Student submissions and analytics");
    console.log("   - Lesson progress tracking");
    console.log("   - Admin activity logs");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding indexes:", error);
    process.exit(1);
  }
}

// Run the migration
addIndexes();