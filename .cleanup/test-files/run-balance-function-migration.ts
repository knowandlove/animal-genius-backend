import { db } from './server/db/index.js';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runBalanceFunctionMigration() {
  try {
    console.log('Running get_student_balance function migration...');
    
    // Read the migration file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations/create-get-student-balance-function.sql'), 
      'utf8'
    );
    
    // Execute the migration
    await db.execute(sql.raw(migrationSQL));
    
    console.log('✅ get_student_balance function created successfully!');
    
    // Test the function
    console.log('Testing the function...');
    const testResult = await db.execute(sql`SELECT get_student_balance('00000000-0000-0000-0000-000000000000'::uuid) as balance`);
    console.log('Test result:', testResult.rows[0]);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runBalanceFunctionMigration();
