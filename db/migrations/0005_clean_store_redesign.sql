-- Clean Store System Redesign
-- This migration creates a fresh store system with proper asset management

-- Drop existing store-related tables if you want a completely fresh start
-- WARNING: This will delete all existing store data!
DROP TABLE IF EXISTS store_items CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS item_animal_positions CASCADE;

-- Create the assets table first (referenced by store_items)
CREATE TABLE assets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  storage_path TEXT UNIQUE NOT NULL,
  bucket TEXT NOT NULL DEFAULT 'store-items',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'active', 'deleted'
  type TEXT NOT NULL, -- 'avatar_hat', 'avatar_accessory', 'room_furniture', etc.
  mime_type TEXT,
  size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour' -- For cleanup of abandoned uploads
);

-- Create index for cleanup job
CREATE INDEX idx_assets_pending_expired ON assets(status, expires_at) WHERE status = 'pending';

-- Create the store_items table with same fields but proper asset reference
CREATE TABLE store_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  item_type VARCHAR(50) NOT NULL, -- 'avatar_hat', 'avatar_accessory', 'room_furniture', 'room_decoration', 'room_wallpaper', 'room_flooring'
  cost INTEGER NOT NULL,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE RESTRICT, -- Now required!
  rarity VARCHAR(20) DEFAULT 'common' NOT NULL, -- 'common', 'rare', 'legendary'
  is_active BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for common queries
CREATE INDEX idx_store_items_active ON store_items(is_active) WHERE is_active = true;
CREATE INDEX idx_store_items_type ON store_items(item_type);
CREATE INDEX idx_store_items_sort ON store_items(sort_order, name);

-- Create item positioning table (same as before)
CREATE TABLE item_animal_positions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  item_id TEXT NOT NULL REFERENCES store_items(id) ON DELETE CASCADE,
  animal_type VARCHAR(20) NOT NULL,
  position_x INTEGER DEFAULT 0 NOT NULL,
  position_y INTEGER DEFAULT 0 NOT NULL,
  scale INTEGER DEFAULT 100 NOT NULL, -- Store as percentage (100 = 1.0)
  rotation INTEGER DEFAULT 0 NOT NULL, -- Store in degrees
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(item_id, animal_type) -- One position per item per animal
);

-- Add update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_store_items_updated_at BEFORE UPDATE ON store_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_item_animal_positions_updated_at BEFORE UPDATE ON item_animal_positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies for security
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_animal_positions ENABLE ROW LEVEL SECURITY;

-- Assets: Only service role can insert/update/delete
CREATE POLICY "Service role manages assets" ON assets
  FOR ALL USING (auth.role() = 'service_role');

-- Store items: Public can read active items, service role can manage
CREATE POLICY "Public reads active store items" ON store_items
  FOR SELECT USING (is_active = true);

CREATE POLICY "Service role manages store items" ON store_items
  FOR ALL USING (auth.role() = 'service_role');

-- Item positions: Same as store items
CREATE POLICY "Public reads item positions" ON item_animal_positions
  FOR SELECT USING (true);

CREATE POLICY "Service role manages item positions" ON item_animal_positions
  FOR ALL USING (auth.role() = 'service_role');
