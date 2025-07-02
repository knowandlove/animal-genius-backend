import { config } from 'dotenv';
config();

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

// Create a pool for the migration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function runMigration() {
  console.log('🚀 Running Authentication System Redesign Migration...');
  console.log('================================================\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations/auth-redesign/001_new_auth_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📋 Migration Details:');
    console.log('- Adding activations table for payment tracking');
    console.log('- Adding classroom_sessions table for temporary access');
    console.log('- Updating students table with fun_code and avatar_id');
    console.log('- Updating classes table with payment fields\n');

    // Run the migration
    console.log('🏃 Executing migration...\n');
    await db.execute(sql.raw(migrationSQL));

    console.log('✅ Migration completed successfully!\n');
    console.log('📝 Next steps:');
    console.log('1. Create curated word lists for fun code generation');
    console.log('2. Build the funCode generator service');
    console.log('3. Implement new authentication endpoints');
    console.log('4. Build the visual student picker UI');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration();