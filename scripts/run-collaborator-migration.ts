#!/usr/bin/env tsx
/**
 * Script to run the co-teacher migration
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  console.log('🚀 Running co-teacher migration...\n');
  
  try {
    // Read the migration file
    const migrationSQL = readFileSync(
      join(__dirname, '../server/db/migrations/add-class-collaborators.sql'),
      'utf-8'
    );
    
    // Execute the migration
    console.log('📋 Creating class_collaborators table and functions...');
    await db.execute(sql.raw(migrationSQL));
    
    console.log('✅ Migration completed successfully!');
    console.log('\nCreated:');
    console.log('- class_collaborators table');
    console.log('- has_class_access() function');
    console.log('- can_edit_class() function');
    console.log('- get_class_role() function');
    console.log('- has_collaborator_permission() function');
    console.log('- Indexes and triggers');
    
    // Verify the table was created
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'class_collaborators'
      );
    `);
    
    if (tableCheck.rows[0]?.exists) {
      console.log('\n✅ Verified: class_collaborators table exists');
    } else {
      console.log('\n❌ Warning: Could not verify table creation');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();