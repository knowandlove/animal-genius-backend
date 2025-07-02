-- Rename fun_code to class_code for clarity
-- This makes it clear that:
-- - classes.class_code = 6-digit code to join a class (e.g., 749858)
-- - students.funcode = Animal-based code to access island (e.g., MEE-X7K)

ALTER TABLE classes RENAME COLUMN fun_code TO class_code;
