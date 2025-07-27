-- Community Hub Tables Migration
-- Created: 2025-01-26
-- Purpose: Add teacher-to-teacher community platform for sharing classroom management strategies

-- Create Community Hub tables for teacher-to-teacher knowledge sharing

-- Discussions table
CREATE TABLE discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(120) NOT NULL,
  body TEXT NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('lessons', 'animals', 'challenges', 'success_stories', 'ask_teachers')),
  battery_level INTEGER CHECK (battery_level >= 1 AND battery_level <= 5),
  view_count INTEGER DEFAULT 0 NOT NULL,
  is_pinned BOOLEAN DEFAULT false NOT NULL,
  status VARCHAR(20) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'resolved', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for discussions
CREATE INDEX idx_discussions_teacher_id ON discussions(teacher_id);
CREATE INDEX idx_discussions_category ON discussions(category);
CREATE INDEX idx_discussions_created_at ON discussions(created_at);
CREATE INDEX idx_discussions_status ON discussions(status);

-- Tags table
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('grade', 'animal_mix', 'challenge_type', 'energy_level', 'class_dynamic', 'time_of_year')),
  slug VARCHAR(100) NOT NULL UNIQUE,
  usage_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for tags
CREATE UNIQUE INDEX idx_tags_slug ON tags(slug);
CREATE INDEX idx_tags_category ON tags(category);

-- Discussion Tags junction table
CREATE TABLE discussion_tags (
  discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (discussion_id, tag_id)
);

-- Create indexes for discussion_tags
CREATE INDEX idx_discussion_tags_discussion ON discussion_tags(discussion_id);
CREATE INDEX idx_discussion_tags_tag ON discussion_tags(tag_id);

-- Replies table (self-referential for nested replies)
CREATE TABLE replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  parent_reply_id UUID REFERENCES replies(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  helpful_count INTEGER DEFAULT 0 NOT NULL,
  is_accepted_answer BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for replies
CREATE INDEX idx_replies_discussion ON replies(discussion_id);
CREATE INDEX idx_replies_parent ON replies(parent_reply_id);
CREATE INDEX idx_replies_teacher ON replies(teacher_id);

-- Interactions table
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  discussion_id UUID REFERENCES discussions(id) ON DELETE CASCADE,
  reply_id UUID REFERENCES replies(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('viewed', 'helpful', 'saved', 'tried_it', 'shared')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for interactions
CREATE INDEX idx_interactions_teacher_discussion ON interactions(teacher_id, discussion_id);
CREATE INDEX idx_interactions_teacher_reply ON interactions(teacher_id, reply_id);
CREATE INDEX idx_interactions_type ON interactions(type);

-- Ensure unique interactions per user per item
CREATE UNIQUE INDEX idx_unique_interaction ON interactions(teacher_id, discussion_id, reply_id, type);

-- Add CHECK constraint to ensure either discussion_id or reply_id is set (but not both)
ALTER TABLE interactions ADD CONSTRAINT check_interaction_target 
  CHECK ((discussion_id IS NOT NULL AND reply_id IS NULL) OR (discussion_id IS NULL AND reply_id IS NOT NULL));

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_discussions_updated_at BEFORE UPDATE ON discussions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_replies_updated_at BEFORE UPDATE ON replies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions for Community Hub tables
GRANT ALL ON discussions TO authenticated;
GRANT ALL ON tags TO authenticated;
GRANT ALL ON discussion_tags TO authenticated;
GRANT ALL ON replies TO authenticated;
GRANT ALL ON interactions TO authenticated;

-- Enable RLS on all Community Hub tables
ALTER TABLE discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for discussions
CREATE POLICY "Teachers can view all discussions" ON discussions
  FOR SELECT USING (true);

CREATE POLICY "Teachers can create their own discussions" ON discussions
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update their own discussions" ON discussions
  FOR UPDATE USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete their own discussions" ON discussions
  FOR DELETE USING (auth.uid() = teacher_id);

-- RLS Policies for tags (everyone can read, only system can modify)
CREATE POLICY "Everyone can view tags" ON tags
  FOR SELECT USING (true);

-- RLS Policies for discussion_tags
CREATE POLICY "Everyone can view discussion tags" ON discussion_tags
  FOR SELECT USING (true);

CREATE POLICY "Discussion authors can tag their discussions" ON discussion_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM discussions 
      WHERE discussions.id = discussion_tags.discussion_id 
      AND discussions.teacher_id = auth.uid()
    )
  );

-- RLS Policies for replies
CREATE POLICY "Teachers can view all replies" ON replies
  FOR SELECT USING (true);

CREATE POLICY "Teachers can create replies" ON replies
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update their own replies" ON replies
  FOR UPDATE USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete their own replies" ON replies
  FOR DELETE USING (auth.uid() = teacher_id);

-- RLS Policies for interactions
CREATE POLICY "Teachers can view their own interactions" ON interactions
  FOR SELECT USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can create their own interactions" ON interactions
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update their own interactions" ON interactions
  FOR UPDATE USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete their own interactions" ON interactions
  FOR DELETE USING (auth.uid() = teacher_id);