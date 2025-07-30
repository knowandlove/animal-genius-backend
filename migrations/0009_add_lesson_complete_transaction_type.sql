-- Add lesson_complete to the allowed positive transaction types
-- This fixes the constraint violation when teachers complete lessons

-- Drop the existing constraint
ALTER TABLE currency_transactions
DROP CONSTRAINT IF EXISTS check_transaction_amount_valid;

-- Recreate the constraint with lesson_complete included
ALTER TABLE currency_transactions
ADD CONSTRAINT check_transaction_amount_valid
CHECK (
  (transaction_type IN ('quiz_reward', 'teacher_grant', 'refund', 'bonus', 'lesson_complete') AND amount > 0) OR
  (transaction_type IN ('purchase', 'teacher_deduction', 'penalty') AND amount < 0) OR
  (transaction_type = 'adjustment' AND amount != 0)
);

-- Add a comment to document the change
COMMENT ON CONSTRAINT check_transaction_amount_valid ON currency_transactions IS
'Ensures transaction amounts match their type (positive for credits including lesson completions, negative for debits)';