-- Migration: Transform Rooms to Gardens
-- Date: 2025-01-25
-- Description: Replace individual room decoration system with collaborative garden plots

-- Archive existing room data (optional - for development reference)
CREATE TABLE IF NOT EXISTS archive_room_data AS 
SELECT * FROM students WHERE room_data IS NOT NULL;

CREATE TABLE IF NOT EXISTS archive_patterns AS 
SELECT * FROM patterns;

CREATE TABLE IF NOT EXISTS archive_room_visits AS 
SELECT * FROM room_visits;

CREATE TABLE IF NOT EXISTS archive_room_guestbook AS 
SELECT * FROM room_guestbook;

-- Drop room-related tables (after archiving)
DROP TABLE IF EXISTS room_visits CASCADE;
DROP TABLE IF EXISTS room_guestbook CASCADE;
DROP TABLE IF EXISTS patterns CASCADE;

-- Create garden schema
CREATE TABLE IF NOT EXISTS garden_plots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID UNIQUE NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  plot_position INTEGER NOT NULL,
  garden_theme VARCHAR(50) DEFAULT 'meadow',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(class_id, plot_position)
);

-- Create planted crops table with (x,y) coordinates for flexibility
CREATE TABLE IF NOT EXISTS planted_crops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID NOT NULL REFERENCES garden_plots(id) ON DELETE CASCADE,
  seed_type VARCHAR(50) NOT NULL,
  planted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  growth_stage INTEGER DEFAULT 0 CHECK (growth_stage >= 0),
  last_watered TIMESTAMP WITH TIME ZONE,
  water_boost_until TIMESTAMP WITH TIME ZONE,
  harvest_ready_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Pre-calculated for performance
  position_x INTEGER NOT NULL CHECK (position_x >= 0),
  position_y INTEGER NOT NULL CHECK (position_y >= 0),
  is_harvested BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1, -- For optimistic locking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_plot_position UNIQUE(plot_id, position_x, position_y)
);

-- Class-wide garden management
CREATE TABLE IF NOT EXISTS class_gardens (
  class_id UUID PRIMARY KEY REFERENCES classes(id) ON DELETE CASCADE,
  garden_level INTEGER DEFAULT 1 CHECK (garden_level >= 1),
  total_harvests INTEGER DEFAULT 0 CHECK (total_harvests >= 0),
  total_earnings INTEGER DEFAULT 0 CHECK (total_earnings >= 0),
  infrastructure_fund INTEGER DEFAULT 0 CHECK (infrastructure_fund >= 0),
  last_watered_at TIMESTAMP WITH TIME ZONE, -- For class-wide watering cooldown
  watering_level INTEGER DEFAULT 1, -- Upgrade level for watering system
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed types catalog
CREATE TABLE IF NOT EXISTS seed_types (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'vegetable', 'flower', 'fruit', 'tree'
  base_growth_hours INTEGER NOT NULL CHECK (base_growth_hours > 0),
  base_sell_price INTEGER NOT NULL CHECK (base_sell_price > 0),
  purchase_price INTEGER NOT NULL CHECK (purchase_price > 0),
  icon_emoji VARCHAR(10),
  rarity VARCHAR(20) DEFAULT 'common',
  available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Garden decorations (benches, paths, etc)
CREATE TABLE IF NOT EXISTS garden_decorations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID NOT NULL REFERENCES garden_plots(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL, -- 'bench', 'path', 'fence', 'pond'
  store_item_id UUID REFERENCES store_items(id) ON DELETE CASCADE,
  position_x INTEGER NOT NULL,
  position_y INTEGER NOT NULL,
  rotation INTEGER DEFAULT 0 CHECK (rotation >= 0 AND rotation < 360),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_decoration_position UNIQUE(plot_id, position_x, position_y)
);

-- Garden themes (replacing patterns)
CREATE TABLE IF NOT EXISTS garden_themes (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  background_color VARCHAR(7) DEFAULT '#8FBC8F',
  ground_texture VARCHAR(50) DEFAULT 'grass',
  is_premium BOOLEAN DEFAULT false,
  unlock_level INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Harvest tracking for analytics
CREATE TABLE IF NOT EXISTS harvest_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  crop_id UUID NOT NULL,
  seed_type VARCHAR(50) NOT NULL,
  coins_earned INTEGER NOT NULL CHECK (coins_earned >= 0),
  growth_time_hours INTEGER NOT NULL,
  was_boosted BOOLEAN DEFAULT false,
  harvested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial seed data
INSERT INTO seed_types (id, name, category, base_growth_hours, base_sell_price, purchase_price, icon_emoji, rarity) VALUES
('carrot', 'Carrot', 'vegetable', 24, 20, 10, '🥕', 'common'),
('tomato', 'Tomato', 'vegetable', 72, 60, 25, '🍅', 'common'),
('sunflower', 'Sunflower', 'flower', 48, 50, 20, '🌻', 'common'),
('strawberry', 'Strawberry', 'fruit', 36, 40, 15, '🍓', 'common'),
('oak_tree', 'Oak Sapling', 'tree', 168, 200, 50, '🌳', 'rare'),
('lettuce', 'Lettuce', 'vegetable', 12, 15, 8, '🥬', 'common'),
('rose', 'Rose', 'flower', 96, 100, 40, '🌹', 'uncommon'),
('apple_tree', 'Apple Sapling', 'tree', 240, 300, 75, '🍎', 'rare')
ON CONFLICT (id) DO NOTHING;

-- Insert basic garden themes
INSERT INTO garden_themes (id, name, description, background_color, ground_texture) VALUES
('meadow', 'Meadow', 'A peaceful grassy meadow', '#8FBC8F', 'grass'),
('desert', 'Desert', 'Sandy desert garden', '#F4A460', 'sand'),
('forest', 'Forest', 'Shaded forest floor', '#228B22', 'moss'),
('beach', 'Beach', 'Coastal garden by the sea', '#FFE4B5', 'sand')
ON CONFLICT (id) DO NOTHING;

-- Drop policies that depend on room_visibility column
DROP POLICY IF EXISTS "Students see classmate pets" ON student_pets;

-- Update students table to remove room data and add garden reference
ALTER TABLE students 
  DROP COLUMN IF EXISTS room_data CASCADE,
  DROP COLUMN IF EXISTS room_visibility CASCADE,
  ADD COLUMN IF NOT EXISTS garden_theme VARCHAR(50) DEFAULT 'meadow';

-- Recreate pet visibility policy for garden system
-- In garden system, all classmate pets are visible (collaborative environment)
CREATE POLICY "Students see classmate pets in garden" ON student_pets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students s1
      JOIN students s2 ON s1.class_id = s2.class_id
      WHERE s1.id = student_pets.student_id
      AND s2.id = auth.uid()
    )
  );

-- First, ensure we have the necessary item types
INSERT INTO item_types (code, name, category, description) VALUES
  ('seeds', 'Seeds', 'garden', 'Seeds for planting in your garden'),
  ('garden_decoration', 'Garden Decoration', 'garden', 'Decorative items for your garden plot'),
  ('garden_tool', 'Garden Tool', 'garden', 'Tools to help with gardening')
ON CONFLICT (code) DO NOTHING;

-- Update store items categories for new system
UPDATE store_items 
SET item_type_id = (
  SELECT id FROM item_types WHERE code = 'garden_decoration'
)
WHERE item_type_id IN (
  SELECT id FROM item_types WHERE category IN ('furniture', 'wall_decoration', 'floor_pattern')
);

-- Add seed items to store
INSERT INTO store_items (name, description, item_type_id, cost, rarity, is_active, sort_order)
SELECT 
  name || ' Seeds',
  'Plant ' || name || ' in your garden',
  (SELECT id FROM item_types WHERE code = 'seeds'),
  purchase_price,
  rarity,
  true,
  sort_order
FROM seed_types
WHERE available = true
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_garden_plots_student_id ON garden_plots(student_id);
CREATE INDEX IF NOT EXISTS idx_garden_plots_class_id ON garden_plots(class_id);
CREATE INDEX IF NOT EXISTS idx_planted_crops_plot_id ON planted_crops(plot_id);
CREATE INDEX IF NOT EXISTS idx_planted_crops_harvest_ready ON planted_crops(harvest_ready_at) WHERE is_harvested = false;
CREATE INDEX IF NOT EXISTS idx_class_gardens_last_watered ON class_gardens(last_watered_at);
CREATE INDEX IF NOT EXISTS idx_harvest_logs_student_id ON harvest_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_harvest_logs_harvested_at ON harvest_logs(harvested_at);

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_garden_plots_updated_at BEFORE UPDATE ON garden_plots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_planted_crops_updated_at BEFORE UPDATE ON planted_crops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_class_gardens_updated_at BEFORE UPDATE ON class_gardens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Feature flag for gradual rollout
CREATE TABLE IF NOT EXISTS feature_flags (
  id VARCHAR(50) PRIMARY KEY,
  is_enabled BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO feature_flags (id, is_enabled, rollout_percentage) VALUES
('garden_system', false, 0)
ON CONFLICT (id) DO NOTHING;

-- Grant permissions for service role
GRANT ALL ON garden_plots TO service_role;
GRANT ALL ON planted_crops TO service_role;
GRANT ALL ON class_gardens TO service_role;
GRANT ALL ON seed_types TO service_role;
GRANT ALL ON garden_decorations TO service_role;
GRANT ALL ON garden_themes TO service_role;
GRANT ALL ON harvest_logs TO service_role;
GRANT ALL ON feature_flags TO service_role;