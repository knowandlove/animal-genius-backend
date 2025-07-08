-- Check if pets table is empty and insert initial data if needed
INSERT INTO "pets" (species, name, description, asset_url, cost, rarity, sort_order) 
SELECT * FROM (VALUES
  ('space_cat', 'Cosmic Cat', 'A mystical feline from the stars', '/assets/pets/space_cat.png', 100, 'common', 1),
  ('code_dog', 'Digital Dog', 'A loyal companion who loves algorithms', '/assets/pets/code_dog.png', 150, 'common', 2),
  ('math_monkey', 'Math Monkey', 'A clever primate who excels at calculations', '/assets/pets/math_monkey.png', 200, 'uncommon', 3)
) AS v(species, name, description, asset_url, cost, rarity, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM pets LIMIT 1);