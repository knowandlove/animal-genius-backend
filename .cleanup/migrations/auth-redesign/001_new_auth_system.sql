-- Migration: New Authentication System
-- Description: Implements the new teacher-centric authentication with visual student picker
-- Created: January 2025

-- 1. Create activations table for payment tracking
CREATE TABLE IF NOT EXISTS activations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  parent_email TEXT NOT NULL,
  activation_code VARCHAR(20) NOT NULL UNIQUE,
  stripe_payment_intent_id TEXT UNIQUE,
  is_activated BOOLEAN DEFAULT FALSE NOT NULL,
  activated_at TIMESTAMPTZ,
  activated_by_student_id UUID REFERENCES students(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Create classroom_sessions table for temporary access codes
CREATE TABLE IF NOT EXISTS classroom_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_code VARCHAR(20) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id)
);

-- 3. Update students table
-- Add fun_code and avatar_id columns, prepare to remove passport_code later
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS fun_code VARCHAR(50) UNIQUE,
  ADD COLUMN IF NOT EXISTS avatar_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS activation_id UUID REFERENCES activations(id);

-- 4. Update classes table
-- Add fields for payment tracking
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS max_students INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS payment_link TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activations_class_id ON activations(class_id);
CREATE INDEX IF NOT EXISTS idx_activations_activation_code ON activations(activation_code);
CREATE INDEX IF NOT EXISTS idx_activations_parent_email ON activations(parent_email);
CREATE INDEX IF NOT EXISTS idx_activations_stripe_payment_intent_id ON activations(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_activations_expires_at ON activations(expires_at);
CREATE INDEX IF NOT EXISTS idx_activations_is_activated ON activations(is_activated);

CREATE INDEX IF NOT EXISTS idx_classroom_sessions_class_id ON classroom_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_classroom_sessions_session_code ON classroom_sessions(session_code);
CREATE INDEX IF NOT EXISTS idx_classroom_sessions_expires_at ON classroom_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_classroom_sessions_is_active ON classroom_sessions(is_active);

CREATE INDEX IF NOT EXISTS idx_students_fun_code ON students(fun_code);
CREATE INDEX IF NOT EXISTS idx_students_activation_id ON students(activation_id);

-- 6. Add update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_activations_updated_at
  BEFORE UPDATE ON activations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 7. Add constraints
ALTER TABLE activations
  ADD CONSTRAINT check_activation_code_format CHECK (activation_code ~ '^[A-Z]+-[A-Z]+-[A-Z0-9]+$'),
  ADD CONSTRAINT check_expires_at_future CHECK (expires_at > created_at);

ALTER TABLE classroom_sessions
  ADD CONSTRAINT check_session_code_format CHECK (session_code ~ '^[A-Z]+-[A-Z]+$'),
  ADD CONSTRAINT check_expires_at_future CHECK (expires_at > created_at);

ALTER TABLE students
  ADD CONSTRAINT check_fun_code_format CHECK (fun_code ~ '^[A-Z]+-[A-Z]+$');

-- 8. Create functions for code generation helpers (to be called from application)
-- Note: The actual generation logic will be in the application code
-- These are just for validation

CREATE OR REPLACE FUNCTION is_valid_activation_code(code TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN code ~ '^[A-Z]{4,6}-[A-Z]{4,6}-[A-Z0-9]{3}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION is_valid_session_code(code TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN code ~ '^[A-Z]{4,8}-[A-Z]{4,8}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 9. Add comments for documentation
COMMENT ON TABLE activations IS 'Tracks payment and activation codes for student access';
COMMENT ON TABLE classroom_sessions IS 'Temporary access codes for classroom login sessions';
COMMENT ON COLUMN activations.activation_code IS 'Format: WORD-WORD-XXX (e.g., BRAVE-STAR-7X9)';
COMMENT ON COLUMN classroom_sessions.session_code IS 'Format: WORD-WORD (e.g., HAPPY-LION)';
COMMENT ON COLUMN students.fun_code IS 'Unique student identifier for visual login';
COMMENT ON COLUMN students.avatar_id IS 'Selected avatar for visual identification';

-- Migration complete!
-- Next steps: 
-- 1. Run application code to generate fun_codes for any existing students
-- 2. After verification, remove passport_code column in a separate migration