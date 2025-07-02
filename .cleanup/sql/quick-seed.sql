-- Quick seed data for item_types to fix 500 error
INSERT INTO item_types (code, name, category, description) VALUES
('hat_basic', 'Basic Hat', 'avatar_hat', 'A simple hat'),
('glasses_basic', 'Basic Glasses', 'avatar_glasses', 'Simple glasses'),
('accessory_basic', 'Basic Accessory', 'avatar_accessory', 'A basic accessory')
ON CONFLICT (code) DO NOTHING;

-- Quick seed data for animal_types
INSERT INTO animal_types (code, name, personality_type, description) VALUES
('meerkat', 'Meerkat', 'ENFP', 'Enthusiastic and creative'),
('owl', 'Owl', 'INTJ', 'Strategic and analytical'),
('dolphin', 'Dolphin', 'ESFJ', 'Friendly and supportive'),
('wolf', 'Wolf', 'ISTJ', 'Dependable and thorough')
ON CONFLICT (code) DO NOTHING;
