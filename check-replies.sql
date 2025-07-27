-- Check if replies exist for the discussion
SELECT 
  r.id,
  r.discussion_id,
  r.body,
  r.teacher_id,
  r.created_at,
  p.first_name,
  p.last_name
FROM replies r
LEFT JOIN profiles p ON r.teacher_id = p.id
WHERE r.discussion_id = '8af34da8-a548-4929-9b0e-2dafc4155a07'
ORDER BY r.created_at DESC;

-- Check if discussion exists and is active
SELECT 
  id,
  title,
  status,
  created_at
FROM discussions 
WHERE id = '8af34da8-a548-4929-9b0e-2dafc4155a07';