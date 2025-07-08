-- Add pattern_id column to store_items table to link store items to patterns
ALTER TABLE store_items 
ADD COLUMN pattern_id UUID REFERENCES patterns(id) ON DELETE SET NULL;

-- Add index for efficient querying
CREATE INDEX idx_store_items_pattern_id ON store_items(pattern_id);

-- Comment for documentation
COMMENT ON COLUMN store_items.pattern_id IS 'Reference to pattern if this store item is a pattern-based item';