-- Currency System Migration
-- Adds passport codes, currency balance, and currency system tables
-- Run this after pushing schema changes

-- Add currency system columns to existing quiz_submissions table
ALTER TABLE "quiz_submissions" 
ADD COLUMN IF NOT EXISTS "passport_code" VARCHAR(8) UNIQUE,
ADD COLUMN IF NOT EXISTS "currency_balance" INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS "avatar_data" JSONB DEFAULT '{}' NOT NULL,
ADD COLUMN IF NOT EXISTS "room_data" JSONB DEFAULT '{}' NOT NULL;

-- Create index for passport code lookups (performance optimization)
CREATE INDEX IF NOT EXISTS "idx_passport_code" ON "quiz_submissions"("passport_code");

-- Create currency transactions table for audit trail
CREATE TABLE IF NOT EXISTS "currency_transactions" (
  "id" SERIAL PRIMARY KEY,
  "student_id" INTEGER NOT NULL REFERENCES "quiz_submissions"("id") ON DELETE CASCADE,
  "teacher_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" INTEGER NOT NULL,
  "reason" VARCHAR(255),
  "transaction_type" VARCHAR(50) NOT NULL CHECK (transaction_type IN ('teacher_gift', 'quiz_complete', 'achievement', 'purchase')),
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create store settings table for teacher store control
CREATE TABLE IF NOT EXISTS "store_settings" (
  "id" SERIAL PRIMARY KEY,
  "class_id" INTEGER NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
  "is_open" BOOLEAN DEFAULT false NOT NULL,
  "opened_at" TIMESTAMP,
  "closes_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create purchase requests table for approval workflow
CREATE TABLE IF NOT EXISTS "purchase_requests" (
  "id" SERIAL PRIMARY KEY,
  "student_id" INTEGER NOT NULL REFERENCES "quiz_submissions"("id") ON DELETE CASCADE,
  "item_type" VARCHAR(50) NOT NULL CHECK (item_type IN ('avatar_hat', 'avatar_accessory', 'room_furniture', 'room_decoration')),
  "item_id" VARCHAR(50) NOT NULL,
  "cost" INTEGER NOT NULL CHECK (cost > 0),
  "status" VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
  "requested_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "processed_at" TIMESTAMP,
  "processed_by" INTEGER REFERENCES "users"("id")
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_currency_transactions_student" ON "currency_transactions"("student_id");
CREATE INDEX IF NOT EXISTS "idx_currency_transactions_teacher" ON "currency_transactions"("teacher_id");
CREATE INDEX IF NOT EXISTS "idx_currency_transactions_created" ON "currency_transactions"("created_at");

CREATE INDEX IF NOT EXISTS "idx_store_settings_class" ON "store_settings"("class_id");
CREATE INDEX IF NOT EXISTS "idx_store_settings_open" ON "store_settings"("is_open");

CREATE INDEX IF NOT EXISTS "idx_purchase_requests_student" ON "purchase_requests"("student_id");
CREATE INDEX IF NOT EXISTS "idx_purchase_requests_status" ON "purchase_requests"("status");
CREATE INDEX IF NOT EXISTS "idx_purchase_requests_requested" ON "purchase_requests"("requested_at");

-- Backfill passport codes for existing quiz submissions
-- This will generate passport codes for all existing students
UPDATE "quiz_submissions" 
SET "passport_code" = UPPER(LEFT("animal_type", 3)) || '-' || 
    UPPER(
      CHR(65 + (RANDOM() * 25)::INT) ||
      CHR(65 + (RANDOM() * 25)::INT) ||
      CHR(48 + (RANDOM() * 9)::INT) ||
      CHR(48 + (RANDOM() * 9)::INT)
    )
WHERE "passport_code" IS NULL;

-- Give existing students a welcome bonus of 100 coins
UPDATE "quiz_submissions" 
SET "currency_balance" = 100 
WHERE "currency_balance" = 0;

-- Log the welcome bonus transactions for existing students
INSERT INTO "currency_transactions" ("student_id", "teacher_id", "amount", "reason", "transaction_type")
SELECT 
  qs.id,
  c.teacher_id,
  100,
  'Welcome bonus for existing student',
  'teacher_gift'
FROM "quiz_submissions" qs
JOIN "classes" c ON qs.class_id = c.id
WHERE qs.currency_balance = 100;

-- Verification queries (uncomment to run manually for testing)
-- SELECT COUNT(*) as total_students, 
--        COUNT(passport_code) as students_with_passport,
--        AVG(currency_balance) as avg_balance
-- FROM quiz_submissions;

-- SELECT COUNT(*) as total_transactions FROM currency_transactions;

COMMIT;