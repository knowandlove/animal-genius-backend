-- Check students with custom avatar colors
SELECT 
  passport_code,
  student_name,
  avatar_data->'colors' as avatar_colors,
  avatar_data->'colors'->'hasCustomized' as has_customized
FROM students 
WHERE avatar_data->'colors' IS NOT NULL
ORDER BY created_at DESC;
