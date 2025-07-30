import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  try {
    console.log('🔄 Running lesson feedback migration...');
    
    // Read the SQL file
    const sqlPath = join(__dirname, '..', 'migrations', 'create_lesson_feedback.sql');
    const sqlContent = readFileSync(sqlPath, 'utf8');
    
    // Split into individual statements
    const statements = sqlContent
      .split(';')
      .filter(s => s.trim())
      .map(s => s.trim());
    
    // Execute each statement
    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 50) + '...');
      try {
        await db.execute(sql.raw(statement));
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log('⚠️  Already exists, skipping...');
        } else {
          throw error;
        }
      }
    }
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Error running migration:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMigration();