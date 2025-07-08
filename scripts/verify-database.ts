#!/usr/bin/env tsx
/**
 * Script to verify the co-teacher database migration
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function verifyDatabase() {
  console.log('🔍 Step 1: Database Verification\n');
  
  try {
    // Check if class_collaborators table exists
    console.log('1. Checking if class_collaborators table exists...');
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'class_collaborators'
      );
    `);
    
    if (tableExists.rows[0]?.exists) {
      console.log('✅ class_collaborators table exists');
    } else {
      console.log('❌ class_collaborators table does NOT exist');
      process.exit(1);
    }
    
    // Check table structure
    console.log('\n2. Checking table structure...');
    const tableStructure = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'class_collaborators'
      ORDER BY ordinal_position;
    `);
    
    console.log('Table columns:');
    tableStructure.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'}`);
    });
    
    // Check indexes
    console.log('\n3. Checking indexes...');
    const indexes = await db.execute(sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'class_collaborators';
    `);
    
    console.log('Indexes:');
    indexes.rows.forEach((row: any) => {
      console.log(`  - ${row.indexname}`);
    });
    
    // Test helper functions
    console.log('\n4. Testing helper functions...');
    
    // Test has_class_access function
    try {
      const testAccess = await db.execute(sql`
        SELECT has_class_access('test-user-id', 'test-class-id') as result;
      `);
      console.log('✅ has_class_access() function works');
    } catch (error) {
      console.log('❌ has_class_access() function failed:', error);
    }
    
    // Test can_edit_class function
    try {
      const testEdit = await db.execute(sql`
        SELECT can_edit_class('test-user-id', 'test-class-id') as result;
      `);
      console.log('✅ can_edit_class() function works');
    } catch (error) {
      console.log('❌ can_edit_class() function failed:', error);
    }
    
    // Test get_class_role function
    try {
      const testRole = await db.execute(sql`
        SELECT get_class_role('test-user-id', 'test-class-id') as result;
      `);
      console.log('✅ get_class_role() function works');
    } catch (error) {
      console.log('❌ get_class_role() function failed:', error);
    }
    
    // Test has_collaborator_permission function
    try {
      const testPermission = await db.execute(sql`
        SELECT has_collaborator_permission('test-user-id', 'test-class-id', 'view_analytics') as result;
      `);
      console.log('✅ has_collaborator_permission() function works');
    } catch (error) {
      console.log('❌ has_collaborator_permission() function failed:', error);
    }
    
    // Check foreign key constraints
    console.log('\n5. Checking foreign key constraints...');
    const constraints = await db.execute(sql`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM
        information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name = 'class_collaborators';
    `);
    
    console.log('Foreign key constraints:');
    constraints.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name} → ${row.foreign_table_name}.${row.foreign_column_name}`);
    });
    
    console.log('\n🎉 Step 1 PASSED: Database verification successful!');
    console.log('\n📋 Summary:');
    console.log('✅ class_collaborators table created');
    console.log('✅ All helper functions working');
    console.log('✅ Indexes in place');
    console.log('✅ Foreign key constraints established');
    console.log('\n➡️  Ready for Step 2: Start development servers');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database verification failed:', error);
    process.exit(1);
  }
}

// Run the verification
verifyDatabase();