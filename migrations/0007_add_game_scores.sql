-- Add game scores table for tracking high scores

-- Game scores table
CREATE TABLE IF NOT EXISTS "game_scores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "class_id" integer NOT NULL,
  "game_type" varchar(50) NOT NULL,
  "score" integer NOT NULL,
  "game_data" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "idx_game_scores_student_id" ON "game_scores" ("student_id");
CREATE INDEX IF NOT EXISTS "idx_game_scores_class_id" ON "game_scores" ("class_id");
CREATE INDEX IF NOT EXISTS "idx_game_scores_game_type" ON "game_scores" ("game_type");
CREATE INDEX IF NOT EXISTS "idx_game_scores_created_at" ON "game_scores" ("created_at");

-- Composite index for leaderboard queries
CREATE INDEX IF NOT EXISTS "idx_game_scores_leaderboard" ON "game_scores" ("class_id", "game_type", "score" DESC);

-- Add foreign keys
DO $$ BEGIN
  ALTER TABLE "game_scores" ADD CONSTRAINT "game_scores_student_id_students_id_fk" 
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "game_scores" ADD CONSTRAINT "game_scores_class_id_classes_id_fk" 
    FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;