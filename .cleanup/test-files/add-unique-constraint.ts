import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function addUniqueConstraint() {
  console.log('🔧 Adding unique constraint to students table...\n');

  try {
    // First check if constraint already exists
    const existingConstraint = await db.execute(sql`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'students' 
      AND constraint_name = 'unique_class_student'
    `);

    if (existingConstraint.rows.length > 0) {
      console.log('✓ Constraint already exists');
      return;
    }

    // Add the unique constraint
    await db.execute(sql`
      ALTER TABLE students 
      ADD CONSTRAINT unique_class_student 
      UNIQUE (class_id, student_name)
    `);

    console.log('✓ Added unique constraint on (class_id, student_name)');

    // Verify it was added
    const verification = await db.execute(sql`
      SELECT 
        conname AS constraint_name,
        pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'students'::regclass
      AND conname = 'unique_class_student'
    `);

    if (verification.rows.length > 0) {
      console.log('\n✅ Constraint verified:');
      console.log(verification.rows[0]);
    }

  } catch (error) {
    console.error('\n❌ Error adding constraint:', error);
  } finally {
    process.exit(0);
  }
}

// Run immediately
addUniqueConstraint();