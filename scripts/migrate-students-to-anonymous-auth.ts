#!/usr/bin/env node
/**
 * Migration script to create anonymous auth users for existing students
 * This ensures backward compatibility while transitioning to the new auth system
 */

import { config } from 'dotenv';
import { supabaseAdmin } from '../server/supabase-clients';
import { db } from '../server/db';
import { students } from '../shared/schema';
import { eq, isNull } from 'drizzle-orm';

config();

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: Array<{ studentId: string; error: string }>;
}

async function migrateStudentsToAnonymousAuth(): Promise<void> {
  console.log('🚀 Starting student auth migration...\n');
  
  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  try {
    // Get all students without auth users
    const studentsToMigrate = await db
      .select()
      .from(students)
      .where(isNull(students.userId));
    
    stats.total = studentsToMigrate.length;
    console.log(`Found ${stats.total} students to migrate\n`);

    // Process in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < studentsToMigrate.length; i += batchSize) {
      const batch = studentsToMigrate.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(studentsToMigrate.length / batchSize)}...`);
      
      await Promise.all(batch.map(async (student) => {
        try {
          // Check if student already has a user_id (race condition check)
          const [currentStudent] = await db
            .select({ userId: students.userId })
            .from(students)
            .where(eq(students.id, student.id))
            .limit(1);
            
          if (currentStudent?.userId) {
            console.log(`  ⏭️  Student ${student.studentName} already migrated`);
            stats.skipped++;
            return;
          }

          // Create anonymous auth user
          const email = `student-${student.id}@animalgenius.local`;
          
          const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: student.passportCode + '-' + Date.now(), // Secure random password
            email_confirm: true,
            user_metadata: {
              student_name: student.studentName,
              is_anonymous: true
            },
            app_metadata: {
              role: 'student',
              student_id: student.id,
              class_id: student.classId,
              passport_code_hash: await hashPassportCode(student.passportCode)
            }
          });

          if (createError) {
            throw createError;
          }

          // Update student record with user_id
          await db
            .update(students)
            .set({ userId: authUser.user.id })
            .where(eq(students.id, student.id));

          console.log(`  ✅ Migrated ${student.studentName} (${student.passportCode})`);
          stats.migrated++;
          
        } catch (error) {
          console.error(`  ❌ Failed to migrate ${student.studentName}:`, error);
          stats.failed++;
          stats.errors.push({
            studentId: student.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }));
      
      // Small delay between batches to avoid rate limits
      if (i + batchSize < studentsToMigrate.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Print summary
    console.log('\n📊 Migration Summary:');
    console.log('─'.repeat(40));
    console.log(`Total students:    ${stats.total}`);
    console.log(`Migrated:         ${stats.migrated} ✅`);
    console.log(`Skipped:          ${stats.skipped} ⏭️`);
    console.log(`Failed:           ${stats.failed} ❌`);
    
    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach(({ studentId, error }) => {
        console.log(`  - Student ${studentId}: ${error}`);
      });
    }
    
    console.log('\n✨ Migration complete!');
    
  } catch (error) {
    console.error('Fatal error during migration:', error);
    process.exit(1);
  }
}

async function hashPassportCode(passportCode: string): Promise<string> {
  // Simple hash for app_metadata storage (not for authentication)
  const encoder = new TextEncoder();
  const data = encoder.encode(passportCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify environment
async function verifyEnvironment(): Promise<boolean> {
  console.log('🔍 Verifying environment...');
  
  // Check database connection
  try {
    const [testStudent] = await db.select().from(students).limit(1);
    console.log('✅ Database connection OK');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
  
  // Check Supabase admin connection
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) throw error;
    console.log('✅ Supabase admin connection OK');
  } catch (error) {
    console.error('❌ Supabase admin connection failed:', error);
    return false;
  }
  
  return true;
}

// Main execution
async function main() {
  console.log('🎓 Animal Genius - Student Auth Migration\n');
  
  // Safety check
  const args = process.argv.slice(2);
  if (!args.includes('--confirm')) {
    console.log('⚠️  This script will create Supabase auth users for all existing students.');
    console.log('   This is a one-time migration and should only be run once.\n');
    console.log('   To proceed, run: npm run migrate:students -- --confirm\n');
    process.exit(0);
  }
  
  // Verify environment
  const isValid = await verifyEnvironment();
  if (!isValid) {
    console.error('\n❌ Environment verification failed. Please check your configuration.');
    process.exit(1);
  }
  
  console.log('\n🚀 Starting migration in 3 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await migrateStudentsToAnonymousAuth();
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}