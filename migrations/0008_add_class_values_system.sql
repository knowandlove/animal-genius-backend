-- Add class values voting system tables
-- This system allows classes to vote on and establish their core values

-- Table to store voting sessions
CREATE TABLE IF NOT EXISTS class_values_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    started_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_class_values_sessions_class_id ON class_values_sessions(class_id);
CREATE INDEX idx_class_values_sessions_status ON class_values_sessions(status);
CREATE INDEX idx_class_values_sessions_active ON class_values_sessions(class_id, status) WHERE status = 'active';

-- Table to store individual student votes
CREATE TABLE IF NOT EXISTS class_values_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES class_values_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    cluster_number INTEGER NOT NULL CHECK (cluster_number BETWEEN 1 AND 4),
    value_code VARCHAR(50) NOT NULL,
    value_name VARCHAR(100) NOT NULL,
    vote_rank INTEGER NOT NULL CHECK (vote_rank BETWEEN 1 AND 3), -- 1st, 2nd, or 3rd choice
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure each student can only vote once per cluster per session
    UNIQUE(session_id, student_id, cluster_number, vote_rank)
);

-- Create indexes for vote counting
CREATE INDEX idx_class_values_votes_session_id ON class_values_votes(session_id);
CREATE INDEX idx_class_values_votes_student_id ON class_values_votes(student_id);
CREATE INDEX idx_class_values_votes_counting ON class_values_votes(session_id, cluster_number, value_code);

-- Table to store the final class values results
CREATE TABLE IF NOT EXISTS class_values_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES class_values_sessions(id) ON DELETE CASCADE,
    cluster_number INTEGER NOT NULL CHECK (cluster_number BETWEEN 1 AND 4),
    value_code VARCHAR(50) NOT NULL,
    value_name VARCHAR(100) NOT NULL,
    vote_count INTEGER NOT NULL DEFAULT 0,
    is_winner BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure we only store unique results per class and cluster
    UNIQUE(class_id, cluster_number, value_code)
);

-- Create indexes for results lookup
CREATE INDEX idx_class_values_results_class_id ON class_values_results(class_id);
CREATE INDEX idx_class_values_results_winners ON class_values_results(class_id, is_winner) WHERE is_winner = true;

-- Add a column to classes table to track if values have been set
ALTER TABLE classes ADD COLUMN IF NOT EXISTS has_values_set BOOLEAN DEFAULT false;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS values_set_at TIMESTAMP WITH TIME ZONE;

-- Create a view for easy access to class values
CREATE OR REPLACE VIEW class_core_values AS
SELECT 
    c.id as class_id,
    c.name as class_name,
    cvr.cluster_number,
    CASE cvr.cluster_number
        WHEN 1 THEN 'In our class, we treat each other by...'
        WHEN 2 THEN 'When things get hard, we agree to...'
        WHEN 3 THEN 'To learn and grow together, we will...'
        WHEN 4 THEN 'Each day, we will...'
    END as cluster_prompt,
    array_agg(cvr.value_name ORDER BY cvr.vote_count DESC) FILTER (WHERE cvr.is_winner = true) as winning_values
FROM classes c
LEFT JOIN class_values_results cvr ON c.id = cvr.class_id AND cvr.is_winner = true
WHERE c.has_values_set = true
GROUP BY c.id, c.name, cvr.cluster_number
ORDER BY c.name, cvr.cluster_number;

-- Function to get voting progress for a session
CREATE OR REPLACE FUNCTION get_voting_progress(p_session_id UUID)
RETURNS TABLE (
    total_students INTEGER,
    students_voted INTEGER,
    completion_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT s.id)::INTEGER as total_students,
        COUNT(DISTINCT v.student_id)::INTEGER as students_voted,
        CASE 
            WHEN COUNT(DISTINCT s.id) > 0 
            THEN ROUND((COUNT(DISTINCT v.student_id)::NUMERIC / COUNT(DISTINCT s.id)::NUMERIC) * 100, 2)
            ELSE 0
        END as completion_percentage
    FROM class_values_sessions cvs
    JOIN classes c ON cvs.class_id = c.id
    JOIN students s ON s.class_id = c.id
    LEFT JOIN class_values_votes v ON v.session_id = cvs.id AND v.student_id = s.id
    WHERE cvs.id = p_session_id
    GROUP BY cvs.id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_class_values_sessions_updated_at
    BEFORE UPDATE ON class_values_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
