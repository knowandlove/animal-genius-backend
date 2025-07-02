import pg from 'pg';
import dotenv from 'dotenv';
import readline from 'readline';

const { Pool } = pg;
dotenv.config();

async function cleanupAllClasses() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🧹 Starting cleanup of all classes and students...\n');

    // Start a transaction
    await pool.query('BEGIN');

    // Get counts before deletion
    const classCount = await pool.query('SELECT COUNT(*) FROM classes');
    const studentCount = await pool.query('SELECT COUNT(*) FROM students');
    const submissionCount = await pool.query('SELECT COUNT(*) FROM quiz_submissions');
    const transactionCount = await pool.query('SELECT COUNT(*) FROM currency_transactions');
    const purchaseCount = await pool.query('SELECT COUNT(*) FROM purchase_history');
    const inventoryCount = await pool.query('SELECT COUNT(*) FROM student_inventory');
    const progressCount = await pool.query('SELECT COUNT(*) FROM lesson_progress');

    console.log('📊 Current database state:');
    console.log(`   Classes: ${classCount.rows[0].count}`);
    console.log(`   Students: ${studentCount.rows[0].count}`);
    console.log(`   Quiz Submissions: ${submissionCount.rows[0].count}`);
    console.log(`   Currency Transactions: ${transactionCount.rows[0].count}`);
    console.log(`   Purchase History: ${purchaseCount.rows[0].count}`);
    console.log(`   Student Inventory: ${inventoryCount.rows[0].count}`);
    console.log(`   Lesson Progress: ${progressCount.rows[0].count}`);
    console.log('');

    // Delete in correct order to avoid foreign key constraints
    console.log('🗑️  Deleting all student-related data...');

    // 1. Delete lesson progress
    const progressResult = await pool.query('DELETE FROM lesson_progress');
    console.log(`   ✓ Deleted ${progressResult.rowCount} lesson progress records`);

    // 2. Delete student inventory
    const inventoryResult = await pool.query('DELETE FROM student_inventory');
    console.log(`   ✓ Deleted ${inventoryResult.rowCount} inventory items`);

    // 3. Delete purchase history
    const purchaseResult = await pool.query('DELETE FROM purchase_history');
    console.log(`   ✓ Deleted ${purchaseResult.rowCount} purchase records`);

    // 4. Delete currency transactions
    const transactionResult = await pool.query('DELETE FROM currency_transactions');
    console.log(`   ✓ Deleted ${transactionResult.rowCount} currency transactions`);

    // 5. Delete quiz submissions
    const submissionResult = await pool.query('DELETE FROM quiz_submissions');
    console.log(`   ✓ Deleted ${submissionResult.rowCount} quiz submissions`);

    // 6. Delete all students
    const studentResult = await pool.query('DELETE FROM students');
    console.log(`   ✓ Deleted ${studentResult.rowCount} students`);

    // 7. Delete store settings for classes
    const storeSettingsResult = await pool.query('DELETE FROM store_settings WHERE class_id IS NOT NULL');
    console.log(`   ✓ Deleted ${storeSettingsResult.rowCount} store settings`);

    // 8. Delete all classes
    const classResult = await pool.query('DELETE FROM classes');
    console.log(`   ✓ Deleted ${classResult.rowCount} classes`);

    // Commit the transaction
    await pool.query('COMMIT');

    console.log('\n✅ Cleanup complete! All classes and students have been removed.');
    console.log('📝 Note: Teacher accounts and store items remain intact.\n');

  } catch (error) {
    // Rollback on error
    await pool.query('ROLLBACK');
    console.error('\n❌ Error during cleanup:', error.message);
    console.error('🔄 All changes have been rolled back.\n');
  } finally {
    await pool.end();
  }
}

// Add confirmation prompt
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('⚠️  WARNING: This will delete ALL classes and students from the database!');
console.log('This includes:');
console.log('  - All classes');
console.log('  - All students');
console.log('  - All quiz submissions');
console.log('  - All currency transactions');
console.log('  - All purchase history');
console.log('  - All student inventory');
console.log('  - All lesson progress\n');
console.log('Teacher accounts and store items will NOT be affected.\n');

rl.question('Are you sure you want to continue? (type "yes" to confirm): ', (answer) => {
  if (answer.toLowerCase() === 'yes') {
    cleanupAllClasses();
  } else {
    console.log('\n❌ Cleanup cancelled.\n');
  }
  rl.close();
});
