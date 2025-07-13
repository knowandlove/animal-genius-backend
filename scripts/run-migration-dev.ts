import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🎯 Running Class Values Migration (Development Mode)\n');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/0008_add_class_values_system.sql');
    console.log('📝 Reading migration file...');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Execute migration
    console.log('🚀 Executing migration...');
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!');

    // Verify tables were created
    const checkQuery = `
      SELECT 
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'class_values_sessions') as sessions,
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'class_values_votes') as votes,
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'class_values_results') as results,
        EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'has_values_set') as column
    `;

    const result = await pool.query(checkQuery);
    const status = result.rows[0];

    console.log('\n📊 Verification:');
    console.log(`   - class_values_sessions: ${status.sessions ? '✅' : '❌'}`);
    console.log(`   - class_values_votes: ${status.votes ? '✅' : '❌'}`);
    console.log(`   - class_values_results: ${status.results ? '✅' : '❌'}`);
    console.log(`   - classes.has_values_set: ${status.column ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();