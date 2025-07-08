#!/usr/bin/env tsx
/**
 * Test script to verify currency balance constraints are working
 * Run after applying the migration: npm run test:currency-constraints
 */

import { db } from '../server/db';
import { students, currencyTransactions } from '@shared/schema';
import { eq } from 'drizzle-orm';

const ANSI_GREEN = '\x1b[32m';
const ANSI_RED = '\x1b[31m';
const ANSI_YELLOW = '\x1b[33m';
const ANSI_RESET = '\x1b[0m';

async function testCurrencyConstraints() {
  console.log('🧪 Testing Currency Balance Constraints...\n');

  // Test 1: Verify constraint prevents negative balance
  console.log('Test 1: Preventing negative balance...');
  try {
    // Find a test student or create one
    const [testStudent] = await db
      .select()
      .from(students)
      .limit(1);

    if (testStudent) {
      // Try to set negative balance (should fail)
      await db
        .update(students)
        .set({ currencyBalance: -100 })
        .where(eq(students.id, testStudent.id));
      
      console.log(`${ANSI_RED}❌ FAILED: Negative balance was allowed!${ANSI_RESET}`);
    } else {
      console.log(`${ANSI_YELLOW}⚠️  SKIPPED: No test student found${ANSI_RESET}`);
    }
  } catch (error: any) {
    if (error.message?.includes('check_currency_balance_non_negative') || 
        error.message?.includes('violates check constraint')) {
      console.log(`${ANSI_GREEN}✅ PASSED: Negative balance correctly rejected${ANSI_RESET}`);
    } else {
      console.log(`${ANSI_RED}❌ FAILED: Unexpected error: ${error.message}${ANSI_RESET}`);
    }
  }

  // Test 2: Verify transaction type validation
  console.log('\nTest 2: Validating transaction types...');
  try {
    const [testStudent] = await db
      .select()
      .from(students)
      .limit(1);

    if (testStudent) {
      // Try to create invalid transaction (negative amount for reward)
      await db
        .insert(currencyTransactions)
        .values({
          studentId: testStudent.id,
          teacherId: testStudent.id, // Just for testing
          amount: -50, // Invalid: rewards should be positive
          transactionType: 'quiz_reward',
          description: 'Invalid test transaction'
        });
      
      console.log(`${ANSI_RED}❌ FAILED: Invalid transaction type was allowed!${ANSI_RESET}`);
    } else {
      console.log(`${ANSI_YELLOW}⚠️  SKIPPED: No test student found${ANSI_RESET}`);
    }
  } catch (error: any) {
    if (error.message?.includes('check_transaction_amount_valid') || 
        error.message?.includes('violates check constraint')) {
      console.log(`${ANSI_GREEN}✅ PASSED: Invalid transaction correctly rejected${ANSI_RESET}`);
    } else {
      console.log(`${ANSI_RED}❌ FAILED: Unexpected error: ${error.message}${ANSI_RESET}`);
    }
  }

  // Test 3: Verify trigger warns on large balance changes
  console.log('\nTest 3: Testing large balance change warning...');
  try {
    const [testStudent] = await db
      .select()
      .from(students)
      .limit(1);

    if (testStudent) {
      // Update with large amount (should succeed but log warning)
      const newBalance = (testStudent.currencyBalance || 0) + 1500;
      await db
        .update(students)
        .set({ currencyBalance: newBalance })
        .where(eq(students.id, testStudent.id));
      
      console.log(`${ANSI_GREEN}✅ PASSED: Large balance change succeeded (check logs for warning)${ANSI_RESET}`);
      
      // Reset balance
      await db
        .update(students)
        .set({ currencyBalance: testStudent.currencyBalance || 0 })
        .where(eq(students.id, testStudent.id));
    } else {
      console.log(`${ANSI_YELLOW}⚠️  SKIPPED: No test student found${ANSI_RESET}`);
    }
  } catch (error: any) {
    console.log(`${ANSI_RED}❌ FAILED: ${error.message}${ANSI_RESET}`);
  }

  // Test 4: Verify indexes exist
  console.log('\nTest 4: Checking indexes...');
  try {
    const result = await db.execute(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'students' 
      AND indexname IN ('idx_students_currency_balance', 'idx_students_class_balance')
    `);
    
    if (result.rows.length === 2) {
      console.log(`${ANSI_GREEN}✅ PASSED: Currency balance indexes exist${ANSI_RESET}`);
    } else {
      console.log(`${ANSI_YELLOW}⚠️  WARNING: Some indexes may be missing (found ${result.rows.length}/2)${ANSI_RESET}`);
    }
  } catch (error: any) {
    console.log(`${ANSI_RED}❌ FAILED: Could not check indexes: ${error.message}${ANSI_RESET}`);
  }

  // Test 5: Verify get_student_balance function
  console.log('\nTest 5: Testing get_student_balance function...');
  try {
    const [testStudent] = await db
      .select()
      .from(students)
      .limit(1);

    if (testStudent) {
      const result = await db.execute(`SELECT get_student_balance($1::uuid) as balance`, [testStudent.id]);
      const balance = result.rows[0].balance;
      
      if (balance >= 0) {
        console.log(`${ANSI_GREEN}✅ PASSED: get_student_balance returned valid balance: ${balance}${ANSI_RESET}`);
      } else {
        console.log(`${ANSI_RED}❌ FAILED: get_student_balance returned negative balance: ${balance}${ANSI_RESET}`);
      }
    } else {
      console.log(`${ANSI_YELLOW}⚠️  SKIPPED: No test student found${ANSI_RESET}`);
    }
  } catch (error: any) {
    console.log(`${ANSI_RED}❌ FAILED: ${error.message}${ANSI_RESET}`);
  }

  console.log('\n🏁 Currency constraint tests completed!');
  process.exit(0);
}

// Run tests
testCurrencyConstraints().catch(error => {
  console.error('Test script failed:', error);
  process.exit(1);
});