import { db, pool } from '../server/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runClassValuesMigration() {
  console.log('🎯 Running Class Values System Migration\n');

  const migrationFile = '0008_add_class_values_system.sql';
  const migrationPath = path.join(__dirname, '../migrations', migrationFile);

  try {
    // First check if tables already exist
    console.log('🔍 Checking current database state...');
    const checkResult = await db.execute(sql`
      SELECT 
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'class_values_sessions') as sessions_exists,
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'class_values_votes') as votes_exists,
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'class_values_results') as results_exists,
        EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'has_values_set') as column_exists
    `);
    
    const status = checkResult.rows[0];
    if (status.sessions_exists && status.votes_exists && status.results_exists && status.column_exists) {
      console.log('✅ Class values tables already exist! No migration needed.\n');
      
      // Show current state
      const sessionCount = await db.execute(sql`SELECT COUNT(*) as count FROM class_values_sessions`);
      const votesCount = await db.execute(sql`SELECT COUNT(*) as count FROM class_values_votes`);
      const resultsCount = await db.execute(sql`SELECT COUNT(*) as count FROM class_values_results`);
      const classesWithValues = await db.execute(sql`SELECT COUNT(*) as count FROM classes WHERE has_values_set = true`);
      
      console.log('📊 Current Data:');
      console.log(`   - Sessions: ${sessionCount.rows[0].count}`);
      console.log(`   - Votes: ${votesCount.rows[0].count}`);
      console.log(`   - Results: ${resultsCount.rows[0].count}`);
      console.log(`   - Classes with values set: ${classesWithValues.rows[0].count}`);
      
      process.exit(0);
    }
    
    // Read migration file
    console.log(`📝 Reading migration file: ${migrationFile}`);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split by semicolons to run multiple statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--')); // Skip empty and comment-only lines
    
    console.log(`   Found ${statements.length} SQL statements to execute\n`);
    
    // Execute each statement
    let successCount = 0;
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const preview = statement.substring(0, 50).replace(/\n/g, ' ');
      console.log(`⚡ Executing [${i + 1}/${statements.length}]: ${preview}...`);
      
      try {
        await db.execute(sql.raw(statement));
        successCount++;
        console.log(`   ✅ Success`);
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log(`   ⏭️  Already exists (skipping)`);
          successCount++;
        } else {
          console.error(`   ❌ Error: ${error.message}`);
          throw error;
        }
      }
    }
    
    console.log(`\n✨ Migration completed! (${successCount}/${statements.length} statements executed)`);
    
    // Verify the migration worked
    console.log('\n🔍 Verifying migration...');
    const verifyResult = await db.execute(sql`
      SELECT 
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'class_values_sessions') as sessions_exists,
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'class_values_votes') as votes_exists,
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'class_values_results') as results_exists,
        EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'has_values_set') as column_exists
    `);
    
    const finalStatus = verifyResult.rows[0];
    if (finalStatus.sessions_exists && finalStatus.votes_exists && finalStatus.results_exists && finalStatus.column_exists) {
      console.log('✅ All class values tables and columns created successfully!');
    } else {
      console.log('⚠️  Some tables or columns may not have been created properly');
      console.log('   Sessions table:', finalStatus.sessions_exists ? '✅' : '❌');
      console.log('   Votes table:', finalStatus.votes_exists ? '✅' : '❌');
      console.log('   Results table:', finalStatus.results_exists ? '✅' : '❌');
      console.log('   has_values_set column:', finalStatus.column_exists ? '✅' : '❌');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

runClassValuesMigration().catch(error => {
  console.error('Failed to run migration:', error);
  process.exit(1);
});