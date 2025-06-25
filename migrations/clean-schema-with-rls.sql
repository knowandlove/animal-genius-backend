-- Clean Schema for Animal Genius Quiz PRO with Supabase Auth Integration
-- This follows Supabase best practices with UUID-based auth

-- Drop existing tables if starting fresh (BE CAREFUL - this deletes all data!)
DROP TABLE IF EXISTS currency_transactions CASCADE;
DROP TABLE IF EXISTS purchase_requests CASCADE;
DROP TABLE IF EXISTS store_settings CASCADE;
DROP TABLE IF EXISTS item_animal_positions CASCADE;
DROP TABLE IF EXISTS store_items CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS admin_logs CASCADE;
DROP TABLE IF EXISTS lesson_progress CASCADE;
DROP TABLE IF EXISTS quiz_submissions CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- PROFILES TABLE (replaces users table)
-- ============================================
-- This links to Supabase Auth and uses UUID as primary key
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  school_organization TEXT NOT NULL,
  role_title TEXT,
  how_heard_about TEXT,
  personality_animal VARCHAR(50),
  is_admin BOOLEAN DEFAULT false NOT NULL,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- CLASSES TABLE
-- ============================================
CREATE TABLE classes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code VARCHAR(6) NOT NULL UNIQUE,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  icon_emoji TEXT DEFAULT '📚',
  icon_color TEXT DEFAULT '#c5d49f',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on classes
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- Classes policies
CREATE POLICY "Teachers can view own classes" ON classes
  FOR SELECT USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can create own classes" ON classes
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update own classes" ON classes
  FOR UPDATE USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete own classes" ON classes
  FOR DELETE USING (auth.uid() = teacher_id);

-- Admin override for classes
CREATE POLICY "Admins can do anything with classes" ON classes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================
-- STUDENTS TABLE
-- ============================================
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  student_name TEXT NOT NULL,
  passport_code VARCHAR(8) NOT NULL UNIQUE,
  wallet_balance INTEGER DEFAULT 0 NOT NULL,
  pending_balance INTEGER DEFAULT 0 NOT NULL,
  currency_balance INTEGER DEFAULT 0 NOT NULL,
  grade_level TEXT,
  animal_type TEXT NOT NULL DEFAULT 'meerkat',
  animal_genius TEXT NOT NULL DEFAULT 'Feeler',
  personality_type VARCHAR(4),
  learning_style TEXT,
  learning_scores JSONB DEFAULT '{}' NOT NULL,
  avatar_data JSONB DEFAULT '{}' NOT NULL,
  room_data JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on students
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Students policies - Teachers can only see students in their classes
CREATE POLICY "Teachers can view students in their classes" ON students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classes 
      WHERE classes.id = students.class_id 
      AND classes.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can manage students in their classes" ON students
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM classes 
      WHERE classes.id = students.class_id 
      AND classes.teacher_id = auth.uid()
    )
  );

-- Admin override for students
CREATE POLICY "Admins can do anything with students" ON students
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================
-- QUIZ SUBMISSIONS TABLE
-- ============================================
CREATE TABLE quiz_submissions (
  id SERIAL PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  grade_level TEXT,
  answers JSONB NOT NULL,
  personality_type VARCHAR(4) NOT NULL,
  animal_type TEXT NOT NULL,
  animal_genius TEXT DEFAULT 'Feeler' NOT NULL,
  scores JSONB NOT NULL,
  learning_style TEXT NOT NULL,
  learning_scores JSONB NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on quiz_submissions
ALTER TABLE quiz_submissions ENABLE ROW LEVEL SECURITY;

-- Quiz submissions policies - Teachers can only see submissions from their classes
CREATE POLICY "Teachers can view submissions in their classes" ON quiz_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classes 
      WHERE classes.id = quiz_submissions.class_id 
      AND classes.teacher_id = auth.uid()
    )
  );

-- Admin override for submissions
CREATE POLICY "Admins can view all submissions" ON quiz_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================
-- LESSON PROGRESS TABLE
-- ============================================
CREATE TABLE lesson_progress (
  id SERIAL PRIMARY KEY,
  teacher_id UUID REFERENCES profiles(id) NOT NULL,
  class_id INTEGER REFERENCES classes(id) NOT NULL,
  lesson_id INTEGER NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on lesson_progress
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

-- Lesson progress policies
CREATE POLICY "Teachers can view own lesson progress" ON lesson_progress
  FOR SELECT USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can manage own lesson progress" ON lesson_progress
  FOR ALL USING (auth.uid() = teacher_id);

-- ============================================
-- CURRENCY TRANSACTIONS TABLE
-- ============================================
CREATE TABLE currency_transactions (
  id SERIAL PRIMARY KEY,
  student_id UUID REFERENCES students(id) NOT NULL,
  teacher_id UUID REFERENCES profiles(id) NOT NULL,
  amount INTEGER NOT NULL,
  reason VARCHAR(255),
  transaction_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on currency_transactions
ALTER TABLE currency_transactions ENABLE ROW LEVEL SECURITY;

-- Currency transaction policies
CREATE POLICY "Teachers can view transactions for their students" ON currency_transactions
  FOR SELECT USING (
    auth.uid() = teacher_id OR
    EXISTS (
      SELECT 1 FROM students 
      JOIN classes ON students.class_id = classes.id
      WHERE students.id = currency_transactions.student_id 
      AND classes.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can create transactions for their students" ON currency_transactions
  FOR INSERT WITH CHECK (
    auth.uid() = teacher_id AND
    EXISTS (
      SELECT 1 FROM students 
      JOIN classes ON students.class_id = classes.id
      WHERE students.id = currency_transactions.student_id 
      AND classes.teacher_id = auth.uid()
    )
  );

-- ============================================
-- STORE SETTINGS TABLE
-- ============================================
CREATE TABLE store_settings (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id) NOT NULL,
  is_open BOOLEAN DEFAULT false NOT NULL,
  opened_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  auto_approval_threshold INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on store_settings
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- Store settings policies
CREATE POLICY "Teachers can manage store settings for their classes" ON store_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM classes 
      WHERE classes.id = store_settings.class_id 
      AND classes.teacher_id = auth.uid()
    )
  );

-- ============================================
-- PURCHASE REQUESTS TABLE
-- ============================================
CREATE TABLE purchase_requests (
  id SERIAL PRIMARY KEY,
  student_id UUID REFERENCES students(id) NOT NULL,
  item_type VARCHAR(50) NOT NULL,
  item_id VARCHAR(50) NOT NULL,
  cost INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES profiles(id)
);

-- Enable RLS on purchase_requests
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;

-- Purchase request policies
CREATE POLICY "Teachers can view purchase requests for their students" ON purchase_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students 
      JOIN classes ON students.class_id = classes.id
      WHERE students.id = purchase_requests.student_id 
      AND classes.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can process purchase requests for their students" ON purchase_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM students 
      JOIN classes ON students.class_id = classes.id
      WHERE students.id = purchase_requests.student_id 
      AND classes.teacher_id = auth.uid()
    )
  );

-- ============================================
-- ADMIN LOGS TABLE
-- ============================================
CREATE TABLE admin_logs (
  id SERIAL PRIMARY KEY,
  admin_id UUID REFERENCES profiles(id) NOT NULL,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES profiles(id),
  target_class_id INTEGER REFERENCES classes(id),
  target_submission_id INTEGER REFERENCES quiz_submissions(id),
  details JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on admin_logs
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- Admin logs policies - only admins can view
CREATE POLICY "Only admins can view admin logs" ON admin_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Only admins can create admin logs" ON admin_logs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================
-- ASSETS TABLE (for store items)
-- ============================================
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  category VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  bucket VARCHAR(50) NOT NULL,
  path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(50),
  size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  variants JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending',
  expires_at TIMESTAMPTZ
);

-- Assets are public readable (store items)
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active assets" ON assets
  FOR SELECT USING (status = 'active');

CREATE POLICY "Admins can manage assets" ON assets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================
-- STORE ITEMS TABLE
-- ============================================
CREATE TABLE store_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  item_type VARCHAR(50) NOT NULL,
  cost INTEGER NOT NULL,
  asset_id UUID NOT NULL REFERENCES assets(id),
  rarity VARCHAR(20) DEFAULT 'common' NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Store items are public readable
ALTER TABLE store_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active store items" ON store_items
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage store items" ON store_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================
-- ITEM ANIMAL POSITIONS TABLE
-- ============================================
CREATE TABLE item_animal_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES store_items(id),
  animal_type VARCHAR(20) NOT NULL,
  position_x INTEGER DEFAULT 0 NOT NULL,
  position_y INTEGER DEFAULT 0 NOT NULL,
  scale INTEGER DEFAULT 100 NOT NULL,
  rotation INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Item positions are public readable
ALTER TABLE item_animal_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view item positions" ON item_animal_positions
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage item positions" ON item_animal_positions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================
-- Critical for RLS policy performance
CREATE INDEX idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX idx_students_class_id ON students(class_id);
CREATE INDEX idx_quiz_submissions_class_id ON quiz_submissions(class_id);
CREATE INDEX idx_quiz_submissions_student_id ON quiz_submissions(student_id);
CREATE INDEX idx_currency_transactions_student_id ON currency_transactions(student_id);
CREATE INDEX idx_currency_transactions_teacher_id ON currency_transactions(teacher_id);
CREATE INDEX idx_purchase_requests_student_id ON purchase_requests(student_id);
CREATE INDEX idx_lesson_progress_teacher_id ON lesson_progress(teacher_id);
CREATE INDEX idx_lesson_progress_class_id ON lesson_progress(class_id);
CREATE INDEX idx_store_settings_class_id ON store_settings(class_id);

-- ============================================
-- HELPER FUNCTION for creating profiles
-- ============================================
-- This function automatically creates a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, school_organization)
  VALUES (
    new.id, 
    new.email,
    COALESCE(new.raw_user_meta_data->>'first_name', 'Unknown'),
    COALESCE(new.raw_user_meta_data->>'last_name', 'User'),
    COALESCE(new.raw_user_meta_data->>'school_organization', 'Unknown School')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- GRANT PERMISSIONS for authenticated users
-- ============================================
-- Allow authenticated users to use the schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
-- Schema created successfully!
-- Next steps:
-- 1. Update your backend code to use auth.uid() for user identification
-- 2. Update API endpoints to remove manual permission checks (RLS handles it now)
-- 3. Test with Supabase Auth users
