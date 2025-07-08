-- Add CHECK constraint to ensure currency balance cannot go negative
-- This provides database-level protection for financial integrity

-- Add check constraint to students table
ALTER TABLE students 
ADD CONSTRAINT check_currency_balance_non_negative 
CHECK (currency_balance >= 0);

-- Add check constraint to ensure transaction amounts make sense
ALTER TABLE currency_transactions
ADD CONSTRAINT check_transaction_amount_valid
CHECK (
  (transaction_type IN ('quiz_reward', 'teacher_grant', 'refund', 'bonus') AND amount > 0) OR
  (transaction_type IN ('purchase', 'teacher_deduction', 'penalty') AND amount < 0) OR
  (transaction_type = 'adjustment' AND amount != 0)
);

-- Create a function to validate balance changes
CREATE OR REPLACE FUNCTION validate_currency_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure the balance never goes negative
  IF NEW.currency_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient funds: balance cannot go negative. Current balance: %, Attempted balance: %', 
      OLD.currency_balance, NEW.currency_balance;
  END IF;
  
  -- Log a warning if balance changes by more than 1000 coins at once (potential bug)
  IF ABS(NEW.currency_balance - OLD.currency_balance) > 1000 THEN
    RAISE WARNING 'Large balance change detected for student %: % -> %', 
      NEW.id, OLD.currency_balance, NEW.currency_balance;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate balance changes
CREATE TRIGGER validate_currency_balance_trigger
BEFORE UPDATE OF currency_balance ON students
FOR EACH ROW
WHEN (OLD.currency_balance IS DISTINCT FROM NEW.currency_balance)
EXECUTE FUNCTION validate_currency_balance();

-- Add index on currency_balance for better performance when checking balances
CREATE INDEX IF NOT EXISTS idx_students_currency_balance ON students(currency_balance);

-- Add composite index for common query pattern (finding students with enough balance)
CREATE INDEX IF NOT EXISTS idx_students_class_balance ON students(class_id, currency_balance);

-- Update the existing get_student_balance function to be more robust
CREATE OR REPLACE FUNCTION get_student_balance(student_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  balance INTEGER;
BEGIN
  SELECT currency_balance INTO balance
  FROM students
  WHERE id = student_uuid;
  
  IF balance IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Extra safety check
  IF balance < 0 THEN
    -- This should never happen with our constraints, but if it does, log and fix
    RAISE WARNING 'Negative balance detected for student %: %', student_uuid, balance;
    
    -- Auto-correct to 0 and update the record
    UPDATE students SET currency_balance = 0 WHERE id = student_uuid;
    RETURN 0;
  END IF;
  
  RETURN balance;
END;
$$ LANGUAGE plpgsql;

-- Add comment to explain the constraint
COMMENT ON CONSTRAINT check_currency_balance_non_negative ON students IS 
'Ensures student currency balance can never go negative, preventing overdraft scenarios';

COMMENT ON CONSTRAINT check_transaction_amount_valid ON currency_transactions IS
'Ensures transaction amounts match their type (positive for credits, negative for debits)';