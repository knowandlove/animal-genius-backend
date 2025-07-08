import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log('🔄 Running database migrations...\n');

  const migrationsDir = path.join(__dirname, '../server/db/migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Run in alphabetical order

  for (const file of migrationFiles) {
    console.log(`📝 Running migration: ${file}`);
    
    try {
      const migrationSQL = fs.readFileSync(
        path.join(migrationsDir, file), 
        'utf-8'
      );
      
      // Split by semicolons to run multiple statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        await db.execute(sql.raw(statement));
      }
      
      console.log(`✅ ${file} - Success\n`);
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log(`⏭️  ${file} - Already applied (skipping)\n`);
      } else {
        console.error(`❌ ${file} - Error:`, error.message, '\n');
      }
    }
  }

  console.log('✨ All migrations completed!');
  process.exit(0);
}

runMigrations().catch(error => {
  console.error('Failed to run migrations:', error);
  process.exit(1);
});