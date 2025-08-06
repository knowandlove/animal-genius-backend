-- Add seed types for the garden system
INSERT INTO seed_types (id, name, category, base_growth_hours, base_sell_price, purchase_price, icon_emoji, rarity, available)
VALUES 
  -- Quick crops (1 day)
  ('tomato', 'Tomato', 'vegetable', 24, 20, 10, '🍅', 'common', true),
  ('lettuce', 'Lettuce', 'vegetable', 24, 18, 8, '🥬', 'common', true),
  ('radish', 'Radish', 'vegetable', 24, 15, 7, '🥕', 'common', true),
  
  -- Medium crops (2-3 days)
  ('strawberry', 'Strawberry', 'fruit', 48, 40, 18, '🍓', 'common', true),
  ('pepper', 'Pepper', 'vegetable', 48, 35, 15, '🌶️', 'common', true),
  ('corn', 'Corn', 'vegetable', 72, 50, 20, '🌽', 'common', true),
  
  -- Long crops (4-5 days)
  ('pumpkin', 'Pumpkin', 'vegetable', 96, 80, 30, '🎃', 'uncommon', true),
  ('watermelon', 'Watermelon', 'fruit', 120, 100, 40, '🍉', 'uncommon', true),
  
  -- Rare crops (5-7 days)
  ('dragonfruit', 'Dragon Fruit', 'fruit', 144, 150, 60, '🐉', 'rare', true),
  ('golden_apple', 'Golden Apple', 'fruit', 168, 200, 80, '🍎', 'rare', true),
  
  -- Flowers (various times)
  ('sunflower', 'Sunflower', 'flower', 48, 30, 12, '🌻', 'common', true),
  ('rose', 'Rose', 'flower', 72, 45, 20, '🌹', 'uncommon', true),
  ('lily', 'Lily', 'flower', 96, 60, 25, '🌷', 'uncommon', true)
ON CONFLICT (id) DO NOTHING;