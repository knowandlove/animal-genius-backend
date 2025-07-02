-- Create store_items table
CREATE TABLE IF NOT EXISTS store_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN (
        'avatar_hat',
        'avatar_accessory',
        'room_furniture',
        'room_decoration',
        'room_wallpaper',
        'room_flooring'
    )),
    cost INTEGER NOT NULL CHECK (cost >= 0),
    image_url VARCHAR(500),
    rarity VARCHAR(20) DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'legendary')),
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_store_items_item_type ON store_items(item_type);
CREATE INDEX idx_store_items_is_active ON store_items(is_active);
CREATE INDEX idx_store_items_sort_order ON store_items(sort_order);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_store_items_updated_at BEFORE UPDATE
    ON store_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies (optional but recommended)
ALTER TABLE store_items ENABLE ROW LEVEL SECURITY;

-- Public can read active items
CREATE POLICY "Public can view active store items" ON store_items
    FOR SELECT USING (is_active = true);

-- Only authenticated admins can manage items
CREATE POLICY "Admins can manage store items" ON store_items
    FOR ALL USING (
        auth.jwt() ->> 'email' IN (
            SELECT email FROM users WHERE is_admin = true
        )
    );
