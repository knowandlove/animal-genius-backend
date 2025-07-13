-- Create lesson_progress table for tracking class-level lesson progress
CREATE TABLE IF NOT EXISTS lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    lesson_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('not_started', 'in_progress', 'completed')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    current_activity INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(class_id, lesson_id)
);

-- Create lesson_activity_progress table for tracking individual activity completion
CREATE TABLE IF NOT EXISTS lesson_activity_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_progress_id UUID NOT NULL REFERENCES lesson_progress(id) ON DELETE CASCADE,
    activity_number INTEGER NOT NULL CHECK (activity_number BETWEEN 1 AND 4),
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lesson_progress_id, activity_number)
);

-- Create indexes for better query performance
CREATE INDEX idx_lesson_progress_class_id ON lesson_progress(class_id);
CREATE INDEX idx_lesson_progress_status ON lesson_progress(status);
CREATE INDEX idx_lesson_activity_progress_lesson_id ON lesson_activity_progress(lesson_progress_id);

-- Enable RLS
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_activity_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies for lesson_progress
CREATE POLICY "Teachers can view their class lesson progress" ON lesson_progress
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM classes c
            WHERE c.id = lesson_progress.class_id
            AND c.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can insert lesson progress for their classes" ON lesson_progress
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM classes c
            WHERE c.id = lesson_progress.class_id
            AND c.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can update their class lesson progress" ON lesson_progress
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM classes c
            WHERE c.id = lesson_progress.class_id
            AND c.teacher_id = auth.uid()
        )
    );

-- RLS policies for lesson_activity_progress
CREATE POLICY "Teachers can view activity progress" ON lesson_activity_progress
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM lesson_progress lp
            JOIN classes c ON c.id = lp.class_id
            WHERE lp.id = lesson_activity_progress.lesson_progress_id
            AND c.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can insert activity progress" ON lesson_activity_progress
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM lesson_progress lp
            JOIN classes c ON c.id = lp.class_id
            WHERE lp.id = lesson_activity_progress.lesson_progress_id
            AND c.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can update activity progress" ON lesson_activity_progress
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM lesson_progress lp
            JOIN classes c ON c.id = lp.class_id
            WHERE lp.id = lesson_activity_progress.lesson_progress_id
            AND c.teacher_id = auth.uid()
        )
    );

-- Grant necessary permissions
GRANT ALL ON lesson_progress TO authenticated;
GRANT ALL ON lesson_activity_progress TO authenticated;
GRANT ALL ON lesson_progress TO service_role;
GRANT ALL ON lesson_activity_progress TO service_role;