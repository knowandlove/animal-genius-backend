-- Seed item_types table with all the categories
INSERT INTO item_types (code, name, category, description) VALUES
('avatar_hat', 'Hat', 'avatar_hat', 'Hats and headwear for avatars'),
('avatar_glasses', 'Glasses', 'avatar_glasses', 'Glasses and eyewear for avatars'),
('avatar_accessory', 'Accessory', 'avatar_accessory', 'Accessories for avatars'),
('room_object', 'Object', 'room_object', 'Decorative objects for rooms'),
('room_furniture', 'Furniture', 'room_furniture', 'Furniture items for rooms'),
('room_floor', 'Floor', 'room_floor', 'Floor designs for rooms'),
('room_wall', 'Wall', 'room_wall', 'Wall designs for rooms')
ON CONFLICT (code) DO NOTHING;
