-- Add room visibility field to students table
-- Default to 'class' to maintain current expected behavior
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS room_visibility VARCHAR(20) DEFAULT 'class' 
CHECK (room_visibility IN ('private', 'class', 'invite_only'));

-- Add index for future queries
CREATE INDEX IF NOT EXISTS idx_students_room_visibility ON students(room_visibility);

-- Comment for documentation
COMMENT ON COLUMN students.room_visibility IS 'Room privacy setting: private (owner only), class (classmates can view), invite_only (requires invitation)';