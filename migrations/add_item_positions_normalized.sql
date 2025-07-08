-- Create item_positions_normalized table for storing avatar item positioning data
CREATE TABLE IF NOT EXISTS item_positions_normalized (
  item_id UUID NOT NULL,
  animal_type VARCHAR(50) NOT NULL,
  position_x FLOAT NOT NULL CHECK (position_x >= 0 AND position_x <= 1),
  position_y FLOAT NOT NULL CHECK (position_y >= 0 AND position_y <= 1),
  scale FLOAT NOT NULL DEFAULT 1 CHECK (scale > 0 AND scale <= 2),
  rotation FLOAT NOT NULL DEFAULT 0 CHECK (rotation >= -180 AND rotation <= 180),
  anchor_x FLOAT NOT NULL DEFAULT 0.5 CHECK (anchor_x >= 0 AND anchor_x <= 1),
  anchor_y FLOAT NOT NULL DEFAULT 0.5 CHECK (anchor_y >= 0 AND anchor_y <= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id, animal_type)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_item_positions_normalized_item_id ON item_positions_normalized(item_id);
CREATE INDEX IF NOT EXISTS idx_item_positions_normalized_animal_type ON item_positions_normalized(animal_type);

-- Create item_metadata table if it doesn't exist
CREATE TABLE IF NOT EXISTS item_metadata (
  item_id UUID PRIMARY KEY,
  item_type VARCHAR(50) NOT NULL,
  natural_width INTEGER,
  natural_height INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create animals table if it doesn't exist
CREATE TABLE IF NOT EXISTS animals (
  animal_type VARCHAR(50) PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  natural_width INTEGER,
  natural_height INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert some default animal types if they don't exist
INSERT INTO animals (animal_type, display_name) VALUES
  ('dolphin', 'Dolphin'),
  ('elephant', 'Elephant'),
  ('giraffe', 'Giraffe'),
  ('lion', 'Lion'),
  ('penguin', 'Penguin'),
  ('panda', 'Panda'),
  ('kangaroo', 'Kangaroo'),
  ('monkey', 'Monkey'),
  ('parrot', 'Parrot'),
  ('bear', 'Bear')
ON CONFLICT (animal_type) DO NOTHING;