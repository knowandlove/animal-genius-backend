-- Add thumbnail_url column to store_items table
ALTER TABLE store_items
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Add comment for clarity
COMMENT ON COLUMN store_items.thumbnail_url IS 'Public URL for the 128x128 thumbnail image';

-- Update existing 'image' asset types to 'static' for clarity
UPDATE store_items 
SET "assetType" = 'static' 
WHERE "assetType" = 'image';

-- Note: We'll keep assetType as varchar instead of enum for flexibility
-- Valid values: 'static' (for PNG/JPG), 'rive' (for RIVE animations)