-- Migration: New Authentication System (Teacher Payment Model)
-- Description: Implements the new teacher-centric authentication with visual student picker
-- Created: January 2025

-- 1. Update classes table for teacher payment model
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS paid_student_count INTEGER DEFAULT 0;

-- 2. Simplify activations table (no parent email needed)
-- Drop the parent_email column since teachers handle payment
ALTER TABLE activations 
  DROP COLUMN IF EXISTS parent_email;

-- 3. Add teacher payment tracking
CREATE TABLE IF NOT EXISTS teacher_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES profiles(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  amount_cents INTEGER NOT NULL,
  student_count INTEGER NOT NULL,
  stripe_payment_intent_id TEXT UNIQUE,
  status VARCHAR(50) DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Create indexes for teacher payments
CREATE INDEX IF NOT EXISTS idx_teacher_payments_teacher_id ON teacher_payments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_payments_class_id ON teacher_payments(class_id);
CREATE INDEX IF NOT EXISTS idx_teacher_payments_status ON teacher_payments(status);

-- 5. Add comments
COMMENT ON TABLE teacher_payments IS 'Tracks teacher payments for class access';
COMMENT ON COLUMN classes.is_paid IS 'Whether teacher has paid for this class';
COMMENT ON COLUMN classes.paid_student_count IS 'Number of student seats purchased';

-- 6. Update trigger for teacher_payments
CREATE TRIGGER update_teacher_payments_updated_at
  BEFORE UPDATE ON teacher_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();