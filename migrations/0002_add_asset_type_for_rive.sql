-- Add asset_type column to store_items table for Rive animation support
ALTER TABLE store_items 
ADD COLUMN asset_type VARCHAR(50) DEFAULT 'image' NOT NULL;

-- Add check constraint to ensure valid asset types
ALTER TABLE store_items 
ADD CONSTRAINT check_asset_type 
CHECK (asset_type IN ('image', 'rive'));

-- Comment for documentation
COMMENT ON COLUMN store_items.asset_type IS 'Type of asset: image (png/jpg) or rive (animation file)';
