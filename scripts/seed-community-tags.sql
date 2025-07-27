-- Community Hub Initial Tags Seed Data
-- This script creates initial tags for the Community Hub feature

-- Insert grade level tags
INSERT INTO tags (name, category, slug, usage_count) VALUES
  ('K-2nd Grade', 'grade', 'k-2', 0),
  ('3rd-5th Grade', 'grade', '3-5', 0),
  ('6th-8th Grade', 'grade', '6-8', 0),
  ('9th-12th Grade', 'grade', '9-12', 0)
ON CONFLICT (slug) DO NOTHING;

-- Insert animal mix tags for common personality combinations
INSERT INTO tags (name, category, slug, usage_count) VALUES
  ('Otter & Beaver Mix', 'animal_mix', 'otter-beaver', 0),
  ('Meerkat & Elephant Mix', 'animal_mix', 'meerkat-elephant', 0),
  ('Owl & Panda Mix', 'animal_mix', 'owl-panda', 0),
  ('Parrot & Collie Mix', 'animal_mix', 'parrot-collie', 0),
  ('All Animal Mix', 'animal_mix', 'all-animals', 0),
  ('High Energy Animals', 'animal_mix', 'high-energy', 0),
  ('Introverted Animals', 'animal_mix', 'introverted', 0),
  ('Extroverted Animals', 'animal_mix', 'extroverted', 0)
ON CONFLICT (slug) DO NOTHING;

-- Insert challenge type tags
INSERT INTO tags (name, category, slug, usage_count) VALUES
  ('Classroom Management', 'challenge_type', 'classroom-management', 0),
  ('Student Engagement', 'challenge_type', 'engagement', 0),
  ('Motivation Issues', 'challenge_type', 'motivation', 0),
  ('Group Dynamics', 'challenge_type', 'group-dynamics', 0),
  ('Behavioral Challenges', 'challenge_type', 'behavior', 0),
  ('Communication Issues', 'challenge_type', 'communication', 0),
  ('Learning Differences', 'challenge_type', 'learning-differences', 0),
  ('Time Management', 'challenge_type', 'time-management', 0),
  ('Parent Communication', 'challenge_type', 'parent-communication', 0),
  ('Conflict Resolution', 'challenge_type', 'conflict-resolution', 0)
ON CONFLICT (slug) DO NOTHING;

-- Insert energy level tags
INSERT INTO tags (name, category, slug, usage_count) VALUES
  ('Low Energy Required', 'energy_level', 'low-energy', 0),
  ('Medium Energy Required', 'energy_level', 'medium-energy', 0),
  ('High Energy Required', 'energy_level', 'high-energy', 0),
  ('Quick Win', 'energy_level', 'quick-win', 0),
  ('Long-term Strategy', 'energy_level', 'long-term', 0)
ON CONFLICT (slug) DO NOTHING;

-- Insert class dynamic tags
INSERT INTO tags (name, category, slug, usage_count) VALUES
  ('Small Class (< 15)', 'class_dynamic', 'small-class', 0),
  ('Medium Class (15-25)', 'class_dynamic', 'medium-class', 0),
  ('Large Class (25+)', 'class_dynamic', 'large-class', 0),
  ('Mixed Age Groups', 'class_dynamic', 'mixed-age', 0),
  ('New Class Setup', 'class_dynamic', 'new-class', 0),
  ('Established Class', 'class_dynamic', 'established-class', 0),
  ('Remote Learning', 'class_dynamic', 'remote-learning', 0),
  ('Hybrid Learning', 'class_dynamic', 'hybrid-learning', 0)
ON CONFLICT (slug) DO NOTHING;

-- Insert time of year tags
INSERT INTO tags (name, category, slug, usage_count) VALUES
  ('Beginning of Year', 'time_of_year', 'beginning-year', 0),
  ('Mid-Year', 'time_of_year', 'mid-year', 0),
  ('End of Year', 'time_of_year', 'end-year', 0),
  ('Holiday Season', 'time_of_year', 'holiday-season', 0),
  ('Testing Season', 'time_of_year', 'testing-season', 0),
  ('Summer School', 'time_of_year', 'summer-school', 0)
ON CONFLICT (slug) DO NOTHING;

-- Output confirmation
SELECT category, COUNT(*) as tag_count 
FROM tags 
GROUP BY category 
ORDER BY category;