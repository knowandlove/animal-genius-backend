import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function fixLessonCompleteConstraint() {
  try {
    console.log('🔧 Fixing lesson_complete transaction type constraint...');
    
    // Drop the existing constraint
    await db.execute(sql`
      ALTER TABLE currency_transactions
      DROP CONSTRAINT IF EXISTS check_transaction_amount_valid
    `);
    console.log('✅ Dropped existing constraint');
    
    // Recreate the constraint with all existing types included
    await db.execute(sql`
      ALTER TABLE currency_transactions
      ADD CONSTRAINT check_transaction_amount_valid
      CHECK (
        (transaction_type IN ('quiz_reward', 'quiz_complete', 'teacher_grant', 'teacher_gift', 'refund', 'bonus', 'lesson_complete') AND amount > 0) OR
        (transaction_type IN ('purchase', 'teacher_deduction', 'penalty') AND amount < 0) OR
        (transaction_type = 'adjustment' AND amount != 0)
      )
    `);
    console.log('✅ Added new constraint with lesson_complete support');
    
    // Add a comment
    await db.execute(sql`
      COMMENT ON CONSTRAINT check_transaction_amount_valid ON currency_transactions IS
      'Ensures transaction amounts match their type (positive for credits including lesson completions, negative for debits)'
    `);
    
    console.log('✅ Constraint fix completed successfully!');
    console.log('ℹ️  Teachers can now complete lessons and award coins to students.');
  } catch (error) {
    console.error('❌ Error fixing constraint:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

fixLessonCompleteConstraint();