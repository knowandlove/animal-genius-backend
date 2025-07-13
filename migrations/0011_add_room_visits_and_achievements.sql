-- Migration: Add Room Visits, Guestbook, and Student Achievements
-- Created: 2025-01-27
-- Description: Add persistent room visit tracking, guestbook feature, and database-driven achievement system

-- ==========================================
-- 1. Room Visits Table (Achievement Tracking)
-- ==========================================

CREATE TABLE IF NOT EXISTS room_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_student_id UUID NOT NULL,
    visited_student_id UUID NOT NULL,
    first_visit_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_visit_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    visit_count INTEGER DEFAULT 1 CHECK (visit_count > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_room_visits_visitor 
        FOREIGN KEY (visitor_student_id) 
        REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT fk_room_visits_visited 
        FOREIGN KEY (visited_student_id) 
        REFERENCES students(id) ON DELETE CASCADE,
    
    -- Ensure a student can't visit their own room
    CONSTRAINT chk_no_self_visits 
        CHECK (visitor_student_id != visited_student_id),
    
    -- One record per visitor-visited pair (for upserts)
    CONSTRAINT uq_visitor_visited 
        UNIQUE (visitor_student_id, visited_student_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_room_visits_visitor ON room_visits(visitor_student_id);
CREATE INDEX IF NOT EXISTS idx_room_visits_visited ON room_visits(visited_student_id);
CREATE INDEX IF NOT EXISTS idx_room_visits_last_visit ON room_visits(last_visit_at);

-- ==========================================
-- 2. Room Guestbook Table
-- ==========================================

-- Create enum for message status
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_status') THEN
        CREATE TYPE message_status AS ENUM (
            'visible',
            'hidden_by_user', 
            'flagged_for_review',
            'hidden_by_admin'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS room_guestbook (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_owner_student_id UUID NOT NULL,
    visitor_student_id UUID NOT NULL,
    message TEXT NOT NULL CHECK (
        length(trim(message)) > 0 AND 
        length(message) <= 500
    ),
    status message_status NOT NULL DEFAULT 'visible',
    
    -- Snapshot visitor info for historical display
    visitor_name VARCHAR(255) NOT NULL,
    visitor_animal_type VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_guestbook_owner 
        FOREIGN KEY (room_owner_student_id) 
        REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT fk_guestbook_visitor 
        FOREIGN KEY (visitor_student_id) 
        REFERENCES students(id) ON DELETE CASCADE,
    
    -- Prevent self-messages
    CONSTRAINT chk_no_self_messages 
        CHECK (room_owner_student_id != visitor_student_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_guestbook_room_owner ON room_guestbook(room_owner_student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guestbook_visitor ON room_guestbook(visitor_student_id);
CREATE INDEX IF NOT EXISTS idx_guestbook_status ON room_guestbook(status) WHERE status != 'visible';

-- ==========================================
-- 3. Student Achievements Table
-- ==========================================

CREATE TABLE IF NOT EXISTS student_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    achievement_code VARCHAR(50) NOT NULL CHECK (length(trim(achievement_code)) > 0),
    achievement_name VARCHAR(255) NOT NULL CHECK (length(trim(achievement_name)) > 0),
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    progress_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_achievements_student 
        FOREIGN KEY (student_id) 
        REFERENCES students(id) ON DELETE CASCADE,
    
    -- One achievement per student
    CONSTRAINT uq_student_achievement 
        UNIQUE (student_id, achievement_code)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_achievements_student ON student_achievements(student_id);
CREATE INDEX IF NOT EXISTS idx_achievements_code ON student_achievements(achievement_code);
CREATE INDEX IF NOT EXISTS idx_achievements_earned ON student_achievements(earned_at);

-- GIN index for querying JSONB progress data
CREATE INDEX IF NOT EXISTS idx_achievements_progress ON student_achievements USING gin(progress_data);

-- ==========================================
-- 4. Security & Row Level Security
-- ==========================================

-- Enable RLS on new tables (following existing patterns)
ALTER TABLE room_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_guestbook ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_achievements ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be refined later)
-- Allow students to see their own data and same-class data
CREATE POLICY IF NOT EXISTS "room_visits_access" ON room_visits
    FOR ALL USING (
        visitor_student_id = auth.uid()::uuid OR 
        visited_student_id = auth.uid()::uuid OR
        EXISTS (
            SELECT 1 FROM students s1, students s2 
            WHERE s1.id = visitor_student_id 
            AND s2.id = visited_student_id 
            AND s1.class_id = s2.class_id
        )
    );

CREATE POLICY IF NOT EXISTS "guestbook_access" ON room_guestbook
    FOR ALL USING (
        room_owner_student_id = auth.uid()::uuid OR 
        visitor_student_id = auth.uid()::uuid OR
        EXISTS (
            SELECT 1 FROM students s1, students s2 
            WHERE s1.id = room_owner_student_id 
            AND s2.id = visitor_student_id 
            AND s1.class_id = s2.class_id
        )
    );

CREATE POLICY IF NOT EXISTS "achievements_access" ON student_achievements
    FOR ALL USING (student_id = auth.uid()::uuid);

-- ==========================================
-- 5. Comments for Documentation
-- ==========================================

COMMENT ON TABLE room_visits IS 'Tracks persistent room visits for achievement system. One record per visitor-visited pair with visit counts.';
COMMENT ON TABLE room_guestbook IS 'Messages left by visitors in student rooms. Includes moderation status and visitor snapshots.';
COMMENT ON TABLE student_achievements IS 'Database-driven achievement system replacing hardcoded achievements. Uses JSONB for flexible progress tracking.';

COMMENT ON COLUMN room_visits.visit_count IS 'Number of times visitor has visited this room (incremented on repeat visits)';
COMMENT ON COLUMN room_guestbook.visitor_name IS 'Snapshot of visitor name at time of message (for historical display if student deleted)';
COMMENT ON COLUMN student_achievements.progress_data IS 'JSONB field for tracking progress toward achievements (e.g., {"visited_rooms": 3, "last_updated": "2025-01-27"})';