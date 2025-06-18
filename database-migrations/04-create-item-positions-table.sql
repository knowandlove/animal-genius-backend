-- Create table for storing item positioning data per animal
CREATE TABLE IF NOT EXISTS item_animal_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id VARCHAR(50) NOT NULL,  -- e.g., 'wizard_hat'
    animal_type VARCHAR(20) NOT NULL,  -- e.g., 'meerkat'
    position_x FLOAT DEFAULT 0,
    position_y FLOAT DEFAULT 0,
    scale FLOAT DEFAULT 1.0,
    rotation FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(item_id, animal_type)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_item_positions_item_id ON item_animal_positions(item_id);
CREATE INDEX IF NOT EXISTS idx_item_positions_animal_type ON item_animal_positions(animal_type);

-- This will store all the custom positions for each item on each animal
-- Example: wizard_hat on meerkat might need position_y: -10 to sit properly
