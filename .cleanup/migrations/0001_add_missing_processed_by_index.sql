-- Add missing index for purchase_requests.processed_by
-- This improves performance when looking up who processed purchase requests

CREATE INDEX IF NOT EXISTS idx_purchase_requests_processed_by 
ON purchase_requests(processed_by);

COMMENT ON INDEX idx_purchase_requests_processed_by IS 'Index for efficient lookup of purchase requests by processor';
