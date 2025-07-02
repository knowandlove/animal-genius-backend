-- Phase 2.5: Simplify Store System
-- Date: January 2025
-- Purpose: Remove approval workflow, keep simple purchase history

-- 1. Simplify purchase_requests to just track history (no approval needed)
ALTER TABLE purchase_requests 
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS processed_at,
DROP COLUMN IF EXISTS processed_by,
DROP COLUMN IF EXISTS notes;

-- Add purchase price to track historical cost
ALTER TABLE purchase_requests
ADD COLUMN IF NOT EXISTS purchase_price INTEGER;

-- Update existing records to use current cost if needed
UPDATE purchase_requests pr
SET purchase_price = pr.cost
WHERE purchase_price IS NULL;

-- Rename table to better reflect its purpose
ALTER TABLE purchase_requests RENAME TO purchase_history;

-- 2. Remove approval threshold from store settings
ALTER TABLE store_settings
DROP COLUMN IF EXISTS auto_approval_threshold;

-- 3. Remove dangling activation reference from students
ALTER TABLE students
DROP COLUMN IF EXISTS activation_id;

-- Drop the related index
DROP INDEX IF EXISTS idx_students_activation_id;

-- 4. Add helpful comments
COMMENT ON TABLE purchase_history IS 'Simple history of all student purchases - no approval needed';
COMMENT ON COLUMN purchase_history.purchase_price IS 'Price paid at time of purchase (for historical tracking)';
