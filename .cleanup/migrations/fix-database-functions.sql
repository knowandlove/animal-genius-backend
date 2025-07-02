-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS generate_passport_code();
DROP FUNCTION IF EXISTS get_student_balance(UUID);

-- Create function to generate unique passport codes for classes
CREATE OR REPLACE FUNCTION generate_passport_code()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate a random 6-character alphanumeric code
        new_code := UPPER(
            SUBSTRING(
                MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT),
                1,
                6
            )
        );
        
        -- Check if this code already exists
        SELECT EXISTS(
            SELECT 1 FROM classes WHERE passport_code = new_code
        ) INTO code_exists;
        
        -- If code doesn't exist, we can use it
        IF NOT code_exists THEN
            RETURN new_code;
        END IF;
        
        -- Otherwise, loop and try again
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Also create a function to get student balance (used by storage-uuid.ts)
CREATE OR REPLACE FUNCTION get_student_balance(student_id UUID)
RETURNS INTEGER AS $$
DECLARE
    total_balance INTEGER;
BEGIN
    SELECT COALESCE(SUM(amount), 0)
    INTO total_balance
    FROM currency_transactions
    WHERE student_id = $1;
    
    RETURN total_balance;
END;
$$ LANGUAGE plpgsql;

-- Test the passport code generation
SELECT generate_passport_code() AS test_code;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Database functions created successfully!';
  RAISE NOTICE 'generate_passport_code() - Generates unique 6-character class codes';
  RAISE NOTICE 'get_student_balance() - Calculates student coin balance';
END $$;
