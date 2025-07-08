-- Add pet system tables

-- Pet catalog table
CREATE TABLE IF NOT EXISTS "pets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "species" varchar(50) NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" text,
  "asset_url" text NOT NULL,
  "cost" integer DEFAULT 100 NOT NULL,
  "rarity" varchar(20) DEFAULT 'common',
  "base_stats" jsonb DEFAULT '{"hungerDecayRate":0.42,"happinessDecayRate":0.625}'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

-- Student pets table (instances of pets owned by students)
CREATE TABLE IF NOT EXISTS "student_pets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "pet_id" uuid NOT NULL,
  "custom_name" varchar(50) NOT NULL,
  "hunger" integer DEFAULT 80 NOT NULL,
  "happiness" integer DEFAULT 80 NOT NULL,
  "last_interaction_at" timestamp with time zone DEFAULT now() NOT NULL,
  "position" jsonb DEFAULT '{"x":200,"y":200}'::jsonb NOT NULL,
  "acquired_at" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

-- Pet interactions log
CREATE TABLE IF NOT EXISTS "pet_interactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_pet_id" uuid NOT NULL,
  "interaction_type" varchar(50) NOT NULL,
  "hunger_before" integer NOT NULL,
  "happiness_before" integer NOT NULL,
  "hunger_after" integer NOT NULL,
  "happiness_after" integer NOT NULL,
  "coins_cost" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_pets_active" ON "pets" ("is_active") WHERE is_active = true;
CREATE INDEX IF NOT EXISTS "idx_student_pets_student_id" ON "student_pets" ("student_id");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_student_pet" ON "student_pets" ("student_id");
CREATE INDEX IF NOT EXISTS "idx_pet_interactions_student_pet_id" ON "pet_interactions" ("student_pet_id");
CREATE INDEX IF NOT EXISTS "idx_pet_interactions_created_at" ON "pet_interactions" ("created_at");

-- Add foreign keys
DO $$ BEGIN
  ALTER TABLE "student_pets" ADD CONSTRAINT "student_pets_student_id_students_id_fk" 
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "student_pets" ADD CONSTRAINT "student_pets_pet_id_pets_id_fk" 
    FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "pet_interactions" ADD CONSTRAINT "pet_interactions_student_pet_id_student_pets_id_fk" 
    FOREIGN KEY ("student_pet_id") REFERENCES "student_pets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Insert initial pet data
INSERT INTO "pets" (species, name, description, asset_url, cost, rarity, sort_order) VALUES
  ('space_cat', 'Cosmic Cat', 'A mystical feline from the stars', '/assets/pets/space_cat.png', 100, 'common', 1),
  ('code_dog', 'Digital Dog', 'A loyal companion who loves algorithms', '/assets/pets/code_dog.png', 150, 'common', 2),
  ('math_monkey', 'Math Monkey', 'A clever primate who excels at calculations', '/assets/pets/math_monkey.png', 200, 'uncommon', 3);