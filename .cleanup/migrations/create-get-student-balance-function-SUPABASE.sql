-- Run this SQL directly in Supabase SQL Editor

-- Create a function to calculate student balance from transactions
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

-- Test the function (should return 0 for non-existent student)
SELECT get_student_balance('00000000-0000-0000-0000-000000000000'::uuid) as test_balance;
