-- Check the structure of the classes table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'classes'
ORDER BY ordinal_position;

-- Check if passport_code column exists
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'classes' AND column_name = 'passport_code';

-- If passport_code doesn't exist, check for 'code' column
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'classes' AND column_name = 'code';
