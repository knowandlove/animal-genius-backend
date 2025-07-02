-- Fix the ambiguous column reference in get_student_balance function
CREATE OR REPLACE FUNCTION get_student_balance(p_student_id UUID)
RETURNS INTEGER AS $$
DECLARE
    total_balance INTEGER;
BEGIN
    SELECT COALESCE(SUM(amount), 0)
    INTO total_balance
    FROM currency_transactions
    WHERE student_id = p_student_id;
    
    RETURN total_balance;
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT get_student_balance('00000000-0000-0000-0000-000000000000'::uuid) AS test_balance;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Fixed get_student_balance function - renamed parameter to avoid ambiguity';
END $$;
