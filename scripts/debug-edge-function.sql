-- Debug why Edge Function can't find the class

-- 1. Check if TEST-123 exists and meets all conditions
SELECT 
  class_code,
  is_active,
  expires_at,
  expires_at > NOW() as "expires_after_now",
  seat_limit,
  -- Check all conditions the Edge Function uses
  CASE 
    WHEN UPPER(class_code) = 'TEST-123' THEN '✅ Code matches'
    ELSE '❌ Code does not match'
  END as code_check,
  CASE 
    WHEN is_active = true THEN '✅ Is active'
    ELSE '❌ Not active'
  END as active_check,
  CASE 
    WHEN expires_at > NOW() THEN '✅ Not expired'
    WHEN expires_at IS NULL THEN '✅ No expiry set'
    ELSE '❌ Expired'
  END as expiry_check
FROM classes
WHERE class_code = 'TEST-123';

-- 2. Also check what the Edge Function would see
SELECT COUNT(*) as matching_classes
FROM classes
WHERE UPPER(class_code) = UPPER('TEST-123')
  AND is_active = true
  AND expires_at > NOW();