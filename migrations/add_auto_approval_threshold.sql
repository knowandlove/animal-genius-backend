-- Add auto-approval threshold to store settings
ALTER TABLE store_settings 
ADD COLUMN auto_approval_threshold INTEGER DEFAULT NULL;

-- Add comment to explain the field
COMMENT ON COLUMN store_settings.auto_approval_threshold IS 'Items with cost <= this value are auto-approved. NULL means no auto-approval.';
