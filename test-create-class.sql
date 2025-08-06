-- Create a test class for avatar customization testing
INSERT INTO public.classes (
  teacher_id,
  name,
  class_code,
  grade_level,
  seat_limit,
  is_active,
  class_values,
  created_at,
  updated_at,
  expires_at,
  student_count,
  school_year
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- Test teacher ID
  'Avatar Test Class',
  'AVT-TST',
  '5',
  30,
  true,
  '[]'::jsonb,
  NOW(),
  NOW(),
  NOW() + INTERVAL '30 days',
  0,
  2025
) ON CONFLICT (class_code) DO UPDATE
SET 
  is_active = true,
  expires_at = NOW() + INTERVAL '30 days',
  updated_at = NOW();

SELECT 'Test class created with code: AVT-TST' as message;
EOF < /dev/null