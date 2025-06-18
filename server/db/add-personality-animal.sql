-- Add personalityAnimal field to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS personality_animal VARCHAR(50);

-- Add check constraint to ensure valid animal values
ALTER TABLE users 
ADD CONSTRAINT check_valid_personality_animal 
CHECK (
  personality_animal IS NULL OR 
  personality_animal IN (
    'Meerkat', 
    'Panda', 
    'Owl', 
    'Beaver', 
    'Elephant', 
    'Otter', 
    'Parrot', 
    'Border Collie'
  )
);