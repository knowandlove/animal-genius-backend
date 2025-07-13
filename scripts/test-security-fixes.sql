-- Test Security Fixes

-- Test 1: Verify passport codes are automatically uppercased
DO $$
DECLARE
    v_test_id UUID;
    v_stored_code TEXT;
BEGIN
    -- Create a test student with lowercase passport code
    v_test_id := gen_random_uuid();
    
    -- This should work and auto-uppercase
    INSERT INTO students (
        id,
        student_name,
        class_id,
        passport_code,
        user_id,
        animal_type,
        school_year
    ) VALUES (
        v_test_id,
        'Test Student',
        (SELECT id FROM classes LIMIT 1), -- Use any existing class
        'ott-tst', -- lowercase!
        gen_random_uuid(),
        'otter',
        '5th'
    );
    
    -- Check if it was uppercased
    SELECT passport_code INTO v_stored_code
    FROM students WHERE id = v_test_id;
    
    IF v_stored_code = 'OTT-TST' THEN
        RAISE NOTICE 'Test 1 PASSED: Passport code auto-uppercased ✓';
    ELSE
        RAISE NOTICE 'Test 1 FAILED: Expected OTT-TST, got %', v_stored_code;
    END IF;
    
    -- Cleanup
    DELETE FROM students WHERE id = v_test_id;
END $$;

-- Test 2: Verify UNIQUE constraint prevents duplicates
DO $$
DECLARE
    v_test_id1 UUID := gen_random_uuid();
    v_test_id2 UUID := gen_random_uuid();
BEGIN
    -- Create first student
    INSERT INTO students (
        id,
        student_name,
        class_id,
        passport_code,
        user_id,
        animal_type,
        school_year
    ) VALUES (
        v_test_id1,
        'Test Student 1',
        (SELECT id FROM classes LIMIT 1),
        'TST-DUP',
        gen_random_uuid(),
        'otter',
        '5th'
    );
    
    -- Try to create second student with same passport code
    BEGIN
        INSERT INTO students (
            id,
            student_name,
            class_id,
            passport_code,
            user_id,
            animal_type,
            school_year
        ) VALUES (
            v_test_id2,
            'Test Student 2',
            (SELECT id FROM classes LIMIT 1),
            'TST-DUP', -- Same code!
            gen_random_uuid(),
            'panda',
            '5th'
        );
        
        RAISE NOTICE 'Test 2 FAILED: Duplicate passport code was allowed!';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE 'Test 2 PASSED: UNIQUE constraint prevented duplicate ✓';
    END;
    
    -- Cleanup
    DELETE FROM students WHERE id = v_test_id1;
END $$;

-- Test 3: Verify format constraint
DO $$
BEGIN
    -- Try invalid format
    BEGIN
        INSERT INTO students (
            id,
            student_name,
            class_id,
            passport_code,
            user_id,
            animal_type,
            school_year
        ) VALUES (
            gen_random_uuid(),
            'Test Student',
            (SELECT id FROM classes LIMIT 1),
            'INVALID-FORMAT-123', -- Wrong format!
            gen_random_uuid(),
            'otter',
            '5th'
        );
        
        RAISE NOTICE 'Test 3 FAILED: Invalid format was allowed!';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Test 3 PASSED: Format constraint blocked invalid code ✓';
    END;
END $$;

-- Test 4: Verify generate_passport_code doesn't have weak fallback
DO $$
DECLARE
    v_code TEXT;
BEGIN
    -- Generate a code
    v_code := generate_passport_code('otter');
    
    IF v_code ~ '^[A-Z]{3}-[A-Z0-9]{3}$' THEN
        RAISE NOTICE 'Test 4 PASSED: Generated valid code: % ✓', v_code;
    ELSE
        RAISE NOTICE 'Test 4 FAILED: Invalid code generated: %', v_code;
    END IF;
END $$;

-- Summary
SELECT 'All tests completed. Check the notices above for results.' as message;