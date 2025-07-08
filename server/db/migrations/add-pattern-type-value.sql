-- Add pattern_type and pattern_value columns to support both CSS and image patterns
ALTER TABLE patterns 
ADD COLUMN IF NOT EXISTS pattern_type VARCHAR(20) NOT NULL DEFAULT 'css';

ALTER TABLE patterns 
ADD COLUMN IF NOT EXISTS pattern_value TEXT;

-- Update existing patterns to have pattern_value based on their code
-- This assumes existing patterns are CSS-based
UPDATE patterns 
SET pattern_value = CASE
  -- Basic patterns
  WHEN code = 'stripes-classic' THEN 'repeating-linear-gradient(45deg, #e0e0e0, #e0e0e0 10px, #f0f0f0 10px, #f0f0f0 20px)'
  WHEN code = 'dots-simple' THEN 'radial-gradient(circle, #d0d0d0 20%, transparent 20%), radial-gradient(circle, #d0d0d0 20%, transparent 20%)'
  WHEN code = 'chevron-modern' THEN 'repeating-linear-gradient(45deg, #e8e8e8 0px, #e8e8e8 10px, transparent 10px, transparent 20px)'
  WHEN code = 'grid-minimal' THEN 'linear-gradient(#ddd 1px, transparent 1px), linear-gradient(90deg, #ddd 1px, transparent 1px)'
  -- You can add more pattern mappings here
  ELSE 'linear-gradient(#f0f0f0, #f0f0f0)' -- Default solid color
END
WHERE pattern_value IS NULL;

-- Make pattern_value required after populating it
ALTER TABLE patterns 
ALTER COLUMN pattern_value SET NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN patterns.pattern_type IS 'Type of pattern: css for CSS-based patterns, image for tiled images';
COMMENT ON COLUMN patterns.pattern_value IS 'Pattern data: CSS string for css type, image URL for image type';