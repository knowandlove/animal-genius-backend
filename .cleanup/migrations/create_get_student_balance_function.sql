-- Create function to calculate student balance from currency transactions
CREATE OR REPLACE FUNCTION get_student_balance(student_uuid uuid)
RETURNS integer AS $$
DECLARE
    total_balance integer;
BEGIN
    SELECT COALESCE(SUM(amount), 0)
    INTO total_balance
    FROM currency_transactions
    WHERE student_id = student_uuid;
    
    RETURN total_balance;
END;
$$ LANGUAGE plpgsql;

-- Add index on currency_transactions for performance
CREATE INDEX IF NOT EXISTS idx_currency_transactions_student_amount 
ON currency_transactions(student_id, amount);
