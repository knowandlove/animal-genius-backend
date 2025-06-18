-- Add indexes for frequently queried fields to improve performance

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

-- Classes table indexes
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_code ON classes(code);
CREATE INDEX IF NOT EXISTS idx_classes_created_at ON classes(created_at DESC);

-- Quiz submissions table indexes
CREATE INDEX IF NOT EXISTS idx_submissions_class_id ON quiz_submissions(class_id);
CREATE INDEX IF NOT EXISTS idx_submissions_completed_at ON quiz_submissions(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_animal_type ON quiz_submissions(animal_type);
CREATE INDEX IF NOT EXISTS idx_submissions_animal_genius ON quiz_submissions(animal_genius);
-- Composite index for analytics queries
CREATE INDEX IF NOT EXISTS idx_submissions_class_id_completed_at ON quiz_submissions(class_id, completed_at DESC);

-- Lesson progress table indexes
CREATE INDEX IF NOT EXISTS idx_lesson_progress_teacher_id ON lesson_progress(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_class_id ON lesson_progress(class_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_completed_at ON lesson_progress(completed_at DESC);
-- Composite index for progress tracking
CREATE INDEX IF NOT EXISTS idx_lesson_progress_class_lesson ON lesson_progress(class_id, lesson_id);

-- Admin logs table indexes
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_timestamp ON admin_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);

-- Analyze tables to update statistics for query planner
ANALYZE users;
ANALYZE classes;
ANALYZE quiz_submissions;
ANALYZE lesson_progress;
ANALYZE admin_logs;