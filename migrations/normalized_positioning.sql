-- Migration to normalized positioning system
-- This redesigns the positioning system to use image-relative coordinates

-- Create animals table to store native dimensions
CREATE TABLE IF NOT EXISTS animals (
    animal_type VARCHAR(255) PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    image_path VARCHAR(255) NOT NULL,
    natural_width INTEGER NOT NULL,
    natural_height INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert animal data with their native dimensions
-- These will need to be updated with actual image dimensions
INSERT INTO animals (animal_type, display_name, image_path, natural_width, natural_height) VALUES
('meerkat', 'Meerkat', '/images/meerkat_full.png', 800, 800),
('panda', 'Panda', '/images/panda_full.png', 800, 800),
('owl', 'Owl', '/images/owl_full.png', 800, 800),
('beaver', 'Beaver', '/images/beaver_full.png', 800, 800),
('elephant', 'Elephant', '/images/elephant_full.png', 800, 800),
('otter', 'Otter', '/images/otter_full.png', 800, 800),
('parrot', 'Parrot', '/images/parrot_full.png', 800, 800),
('border-collie', 'Border Collie', '/images/border_collie_full.png', 800, 800);

-- Create new item_positions table with normalized coordinates
CREATE TABLE IF NOT EXISTS item_positions_normalized (
    item_id VARCHAR(255) NOT NULL,
    animal_type VARCHAR(255) NOT NULL,
    -- Normalized coordinates (0.0 to 1.0) relative to the image
    position_x DECIMAL(10, 9) NOT NULL,
    position_y DECIMAL(10, 9) NOT NULL,
    -- Scale relative to largest dimension of avatar
    scale DECIMAL(10, 9) NOT NULL,
    -- Rotation in degrees
    rotation SMALLINT NOT NULL DEFAULT 0,
    -- Anchor points for the item (0.0 to 1.0)
    anchor_x DECIMAL(10, 9) NOT NULL DEFAULT 0.5,
    anchor_y DECIMAL(10, 9) NOT NULL DEFAULT 0.5,
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (item_id, animal_type),
    FOREIGN KEY (animal_type) REFERENCES animals(animal_type)
);

-- Create items metadata table
CREATE TABLE IF NOT EXISTS item_metadata (
    item_id VARCHAR(255) PRIMARY KEY,
    item_type VARCHAR(50) NOT NULL, -- 'hat', 'glasses', 'accessory'
    natural_width INTEGER,
    natural_height INTEGER,
    -- Default anchor points for this item type
    default_anchor_x DECIMAL(10, 9) NOT NULL DEFAULT 0.5,
    default_anchor_y DECIMAL(10, 9) NOT NULL DEFAULT 0.5
);

-- Set default anchors for different item types
-- Hats anchor at bottom-center, glasses at center, etc.
INSERT INTO item_metadata (item_id, item_type, default_anchor_x, default_anchor_y)
SELECT DISTINCT si.id, si.item_type,
    CASE 
        WHEN si.item_type = 'avatar_hat' THEN 0.5  -- center horizontally
        WHEN si.item_type = 'avatar_glasses' THEN 0.5
        ELSE 0.5
    END as default_anchor_x,
    CASE 
        WHEN si.item_type = 'avatar_hat' THEN 1.0  -- bottom for hats
        WHEN si.item_type = 'avatar_glasses' THEN 0.5  -- center for glasses
        ELSE 0.5
    END as default_anchor_y
FROM store_items si
WHERE si.item_type IN ('avatar_hat', 'avatar_glasses', 'avatar_accessory')
ON CONFLICT (item_id) DO NOTHING;

-- Migrate existing data (if any)
-- This assumes the old positions were created in a 600x600 container
INSERT INTO item_positions_normalized (
    item_id, animal_type, 
    position_x, position_y, 
    scale, rotation,
    anchor_x, anchor_y
)
SELECT 
    ip.item_id,
    ip.animal_type,
    ip.position_x / 100.0,  -- Convert percentage to 0-1 range
    ip.position_y / 100.0,
    ip.scale / 100.0,  -- Convert to normalized scale
    ip.rotation,
    COALESCE(im.default_anchor_x, 0.5),
    COALESCE(im.default_anchor_y, 0.5)
FROM item_positions ip
LEFT JOIN item_metadata im ON ip.item_id = im.item_id
WHERE ip.item_id IS NOT NULL;

-- Add indexes for performance
CREATE INDEX idx_item_positions_normalized_item_id ON item_positions_normalized(item_id);
CREATE INDEX idx_item_positions_normalized_animal_type ON item_positions_normalized(animal_type);