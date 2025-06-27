import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config();

const { Pool } = pg;

async function runMigration() {
  const migrationFile = process.argv[2];
  
  if (!migrationFile) {
    console.error("Usage: npm run migrate <migration-file.sql>");
    process.exit(1);
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  try {
    console.log(`Running migration: ${migrationFile}`);
    
    const migrationPath = path.join(__dirname, migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`Migration file not found: ${migrationPath}`);
      process.exit(1);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, "utf-8");

    await db.execute(sql.raw(migrationSQL));
    
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
