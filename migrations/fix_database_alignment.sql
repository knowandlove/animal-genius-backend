-- Fix 1: Remove completedAt from IslandData type (handle in code)

-- Fix 2: Consolidate student names
UPDATE students 
SET student_name = COALESCE(student_name, name) 
WHERE student_name IS NULL AND name IS NOT NULL;

-- After verifying data is migrated, drop the redundant column
-- ALTER TABLE students DROP COLUMN name;

-- Fix 3: Add index for performance on purchase_requests
CREATE INDEX IF NOT EXISTS idx_purchase_requests_student_status 
ON purchase_requests(student_id, status);

-- Fix 4: Ensure cascade behaviors are correct
-- Change purchase_requests foreign key to preserve history
ALTER TABLE purchase_requests 
DROP CONSTRAINT IF EXISTS purchase_requests_store_item_id_fkey;

ALTER TABLE purchase_requests 
ADD CONSTRAINT purchase_requests_store_item_id_fkey 
FOREIGN KEY (store_item_id) 
REFERENCES store_items(id) 
ON DELETE SET NULL;
