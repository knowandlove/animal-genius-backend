-- Add coins_awarded_at column to lesson_progress table
-- This tracks when coins were awarded for lesson completion to prevent double rewards
ALTER TABLE lesson_progress 
ADD COLUMN IF NOT EXISTS coins_awarded_at TIMESTAMP WITH TIME ZONE;

-- Add index on coins_awarded_at for efficient queries
CREATE INDEX IF NOT EXISTS idx_lesson_progress_coins_awarded_at 
ON lesson_progress(coins_awarded_at) 
WHERE coins_awarded_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN lesson_progress.coins_awarded_at IS 'Timestamp when coins were awarded for completing this lesson. Prevents double rewards.';