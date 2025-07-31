# Currency Balance Constraint Migration

**Last Updated:** July 29, 2025

## Overview
This migration adds database-level constraints to ensure financial data integrity:

1. **Non-negative balance constraint** - Students can never have negative currency balances
2. **Transaction type validation** - Ensures transaction amounts match their type (positive for credits, negative for debits)
3. **Balance change trigger** - Validates and logs large balance changes
4. **Performance indexes** - Optimizes balance-related queries

## Running the Migration

### Development
```bash
# Using Drizzle (if configured)
npm run db:migrate

# Or manually via psql
psql $DATABASE_URL -f migrations/0005_add_currency_balance_constraint.sql
```

### Production
1. **Backup your database first!**
2. Run during low-traffic period
3. Monitor for any constraint violations

```bash
# Check for any existing negative balances before migration
psql $DATABASE_URL -c "SELECT id, student_name, currency_balance FROM students WHERE currency_balance < 0;"

# If any exist, fix them first
psql $DATABASE_URL -c "UPDATE students SET currency_balance = 0 WHERE currency_balance < 0;"

# Then run the migration
psql $DATABASE_URL -f migrations/0005_add_currency_balance_constraint.sql
```

## What This Prevents

### Before Migration
- Students could have negative balances due to race conditions
- No validation on transaction types
- No database-level protection against overdrafts

### After Migration
- Database rejects any attempt to set balance < 0
- Transaction amounts must match their type
- Large balance changes are logged for monitoring
- Better query performance with new indexes

## Rollback
If needed, you can rollback with:

```sql
-- Remove constraints
ALTER TABLE students DROP CONSTRAINT IF EXISTS check_currency_balance_non_negative;
ALTER TABLE currency_transactions DROP CONSTRAINT IF EXISTS check_transaction_amount_valid;

-- Remove trigger and function
DROP TRIGGER IF EXISTS validate_currency_balance_trigger ON students;
DROP FUNCTION IF EXISTS validate_currency_balance();

-- Remove indexes (optional, they don't hurt to keep)
DROP INDEX IF EXISTS idx_students_currency_balance;
DROP INDEX IF EXISTS idx_students_class_balance;
```

## Testing
After migration, test that constraints work:

```sql
-- This should fail
UPDATE students SET currency_balance = -1 WHERE id = 'any-student-id';
-- ERROR: new row for relation "students" violates check constraint "check_currency_balance_non_negative"

-- This should fail
INSERT INTO currency_transactions (student_id, teacher_id, amount, transaction_type, description)
VALUES ('student-id', 'teacher-id', -100, 'quiz_reward', 'Invalid negative reward');
-- ERROR: new row for relation "currency_transactions" violates check constraint "check_transaction_amount_valid"
```