-- Create payment status enum
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- Update classes table: replace is_paid with payment_status
ALTER TABLE classes 
DROP COLUMN IF EXISTS is_paid,
ADD COLUMN payment_status payment_status DEFAULT 'pending' NOT NULL;

-- Remove stripe_payment_intent_id from activations table (it belongs in teacher_payments)
ALTER TABLE activations 
DROP COLUMN IF EXISTS stripe_payment_intent_id;

-- Add index for payment_status on classes table for efficient filtering
CREATE INDEX idx_classes_payment_status ON classes(payment_status);

-- Update any existing paid classes to 'succeeded' status
-- (This is safe since we have no production data yet)
UPDATE classes 
SET payment_status = 'succeeded' 
WHERE paid_at IS NOT NULL;
