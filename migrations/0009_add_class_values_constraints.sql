-- Add additional constraints for class values voting system security and data integrity

-- Add unique constraint to prevent duplicate values within same session/student/cluster
-- This ensures a student can't vote for the same value multiple times in a cluster
ALTER TABLE class_values_votes 
ADD CONSTRAINT unique_session_student_value 
UNIQUE (session_id, student_id, value_code);

-- Add constraint to ensure each student votes exactly once per rank per cluster
-- (This already exists in the original migration but let's make it explicit)
-- UNIQUE(session_id, student_id, cluster_number, vote_rank) already exists

-- Add check constraint to ensure vote_rank matches expected pattern
-- Each cluster should have exactly one rank 1, one rank 2, and one rank 3
-- This is better enforced at application level with transactions

-- Add index for better performance on vote tallying
CREATE INDEX IF NOT EXISTS idx_class_values_votes_tallying 
ON class_values_votes(session_id, value_code, vote_rank);

-- Add constraint on results table to prevent duplicate results per session
ALTER TABLE class_values_results 
ADD CONSTRAINT unique_session_cluster_value 
UNIQUE (session_id, cluster_number, value_code);

-- Add total_score column to store weighted vote scores
ALTER TABLE class_values_results 
ADD COLUMN IF NOT EXISTS total_score INTEGER NOT NULL DEFAULT 0;

-- Add index for session status checks
CREATE INDEX IF NOT EXISTS idx_class_values_sessions_expires 
ON class_values_sessions(expires_at) 
WHERE status = 'active';

-- Add comment documenting the voting weight system
COMMENT ON COLUMN class_values_results.total_score IS 'Weighted score: 1st choice = 3 points, 2nd = 2 points, 3rd = 1 point';