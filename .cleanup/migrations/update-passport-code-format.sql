-- Update generate_passport_code to generate XXX-XXX format codes
CREATE OR REPLACE FUNCTION generate_passport_code()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    i INTEGER;
BEGIN
    LOOP
        -- Generate a random code in format XXX-XXX
        new_code := '';
        
        -- First 3 characters
        FOR i IN 1..3 LOOP
            new_code := new_code || SUBSTRING(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INTEGER, 1);
        END LOOP;
        
        -- Add dash
        new_code := new_code || '-';
        
        -- Last 3 characters
        FOR i IN 1..3 LOOP
            new_code := new_code || SUBSTRING(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INTEGER, 1);
        END LOOP;
        
        -- Check if this code already exists in classes table
        SELECT EXISTS(
            SELECT 1 FROM classes WHERE passport_code = new_code
        ) INTO code_exists;
        
        -- If code doesn't exist in classes, check students table too
        IF NOT code_exists THEN
            SELECT EXISTS(
                SELECT 1 FROM students WHERE passport_code = new_code
            ) INTO code_exists;
        END IF;
        
        -- If code doesn't exist in either table, we can use it
        IF NOT code_exists THEN
            RETURN new_code;
        END IF;
        
        -- Otherwise, loop and try again
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT generate_passport_code() AS test_code;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Updated generate_passport_code to create XXX-XXX format codes';
END $$;
