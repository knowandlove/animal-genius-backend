-- Migration: Remove unused autoApprovalThreshold column from store_settings table
-- Date: 2024-01-03
-- Reason: This column was part of the purchase request approval system that has been removed

-- Drop the column if it exists
ALTER TABLE store_settings 
DROP COLUMN IF EXISTS auto_approval_threshold;

-- Add a comment to track this migration
COMMENT ON TABLE store_settings IS 'Store configuration per teacher. auto_approval_threshold column removed on 2024-01-03 as purchase approval system was discontinued.';