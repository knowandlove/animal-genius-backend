-- Create patterns table for storing drawing patterns/templates
-- Patterns are pre-defined designs that students can use as backgrounds or overlays in their artwork
CREATE TABLE IF NOT EXISTS patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  surface_type VARCHAR(50) NOT NULL CHECK (surface_type IN ('background', 'overlay', 'texture')),
  theme VARCHAR(100),
  thumbnail_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX idx_patterns_code ON patterns(code);
CREATE INDEX idx_patterns_surface_type ON patterns(surface_type);
CREATE INDEX idx_patterns_theme ON patterns(theme) WHERE theme IS NOT NULL;
CREATE INDEX idx_patterns_is_active ON patterns(is_active);
CREATE INDEX idx_patterns_created_at ON patterns(created_at DESC);

-- Composite index for common queries filtering by type and active status
CREATE INDEX idx_patterns_type_active ON patterns(surface_type, is_active) WHERE is_active = true;

-- Comments for documentation
COMMENT ON TABLE patterns IS 'Stores pre-defined drawing patterns and templates for student artwork';
COMMENT ON COLUMN patterns.code IS 'Unique identifier code for the pattern, used in API references';
COMMENT ON COLUMN patterns.name IS 'Human-readable name of the pattern';
COMMENT ON COLUMN patterns.description IS 'Detailed description of the pattern and its intended use';
COMMENT ON COLUMN patterns.surface_type IS 'Type of surface: background (behind drawings), overlay (on top), or texture (blended)';
COMMENT ON COLUMN patterns.theme IS 'Thematic category of the pattern (e.g., nature, geometric, abstract)';
COMMENT ON COLUMN patterns.thumbnail_url IS 'URL to the pattern thumbnail image for preview';
COMMENT ON COLUMN patterns.is_active IS 'Whether the pattern is currently available for use';
COMMENT ON COLUMN patterns.created_at IS 'Timestamp when the pattern was added to the system';