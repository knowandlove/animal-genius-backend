-- Debug: Check what's in the classes table
SELECT 
  id,
  name,
  class_code,
  is_active,
  expires_at,
  expires_at > NOW() as "not_expired",
  seat_limit
FROM classes
ORDER BY created_at DESC
LIMIT 10;

-- Check if the columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'classes' 
AND column_name IN ('class_code', 'is_active', 'expires_at', 'seat_limit')
ORDER BY column_name;