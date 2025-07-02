-- Create get_student_balance function if it doesn't exist
-- This function calculates the total balance for a student from currency transactions

CREATE OR REPLACE FUNCTION get_student_balance(student_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    total_balance INTEGER;
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO total_balance
    FROM currency_transactions
    WHERE student_id = student_uuid;
    
    RETURN total_balance;
END;
$$ LANGUAGE plpgsql;

-- Add index to improve performance
CREATE INDEX IF NOT EXISTS idx_currency_transactions_student_balance 
ON currency_transactions(student_id, amount);

-- Add comment
COMMENT ON FUNCTION get_student_balance(UUID) IS 
'Calculates the total currency balance for a student by summing all their transactions';
