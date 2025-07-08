-- Add thumbnail_url column to store_items table
-- This was defined in schema but missing from the actual database
ALTER TABLE store_items 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN store_items.thumbnail_url IS 'URL for 128x128 thumbnail image';