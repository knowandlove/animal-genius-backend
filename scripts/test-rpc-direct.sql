-- Test the RPC function directly
SELECT submit_quiz_atomic(
  'TEST-123',  -- p_class_code
  'Jane',      -- first_name
  'S',         -- last_initial
  '5',         -- grade
  '{"q1": "A", "q2": "B", "q3": "C", "q4": "D", "q5": "A"}'::jsonb  -- quiz_answers
);
EOF < /dev/null