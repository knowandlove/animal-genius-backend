-- Migration: Drop purchase_requests table
-- Date: 2025-01-03
-- Reason: Purchase request system has been removed in favor of direct purchase

-- Drop indexes first
DROP INDEX IF EXISTS idx_purchase_requests_student_id;
DROP INDEX IF EXISTS idx_purchase_requests_store_item_id;
DROP INDEX IF EXISTS idx_purchase_requests_processed_by;
DROP INDEX IF EXISTS idx_purchase_requests_status;
DROP INDEX IF EXISTS idx_purchase_requests_student_status;

-- Drop the table (CASCADE will handle foreign key constraints)
DROP TABLE IF EXISTS purchase_requests CASCADE;

-- Add comment to document this change
COMMENT ON SCHEMA public IS 'Animal Genius database schema. Note: purchase_requests table was dropped on 2025-01-03 as the system moved to direct purchases without approval workflow.';