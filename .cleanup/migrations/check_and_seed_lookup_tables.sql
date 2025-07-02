-- Animal Genius Quiz PRO - Lookup Tables Check and Seed Script
-- Created: January 2025
-- Purpose: Document and seed animal_types and genius_types lookup tables

-- ============================================
-- PART 1: CHECK EXISTING DATA
-- ============================================

-- Check current animal types
SELECT 'Current Animal Types:' as info;
SELECT id, code, name, personality_type, genius_type, description 
FROM animal_types 
ORDER BY name;

-- Check current genius types
SELECT 'Current Genius Types:' as info;
SELECT id, code, name, description 
FROM genius_types 
ORDER BY name;

-- Check if any students are using these relationships
SELECT 'Students with animal/genius types:' as info;
SELECT COUNT(*) as total_students,
       COUNT(animal_type_id) as with_animal_type,
       COUNT(genius_type_id) as with_genius_type
FROM students;

-- ============================================
-- PART 2: SEED DATA (Only run if tables are empty)
-- ============================================

-- To completely reset and reseed (DANGEROUS - only if no students exist):
-- DELETE FROM students WHERE animal_type_id IS NOT NULL OR genius_type_id IS NOT NULL;
-- DELETE FROM animal_types;
-- DELETE FROM genius_types;

-- Seed genius_types (if empty)
INSERT INTO genius_types (id, code, name, description) VALUES
    (gen_random_uuid(), 'creative', 'Creative Genius', 'Imaginative and artistic thinking'),
    (gen_random_uuid(), 'social', 'Social Genius', 'Understanding and connecting with others'),
    (gen_random_uuid(), 'analytical', 'Analytical Genius', 'Logical and systematic thinking'),
    (gen_random_uuid(), 'practical', 'Practical Genius', 'Hands-on problem solving')
ON CONFLICT (code) DO NOTHING;

-- Seed animal_types (if empty)
INSERT INTO animal_types (id, code, name, personality_type, genius_type, description) VALUES
    (gen_random_uuid(), 'meerkat', 'Meerkat', 'ENFP', 'Creative & Empathetic', 'Imaginative and caring, always thinking of others'),
    (gen_random_uuid(), 'panda', 'Panda', 'INTJ', 'Thoughtful & Strategic', 'Deep thinkers who plan ahead and see the big picture'),
    (gen_random_uuid(), 'owl', 'Owl', 'INTP', 'Independent & Analytical', 'Logical problem-solvers who value knowledge and understanding'),
    (gen_random_uuid(), 'beaver', 'Beaver', 'ISTJ', 'Reliable & Organized', 'Hardworking and detail-oriented, they get things done right'),
    (gen_random_uuid(), 'elephant', 'Elephant', 'ESFJ', 'Caring & Social', 'Warm and supportive, they remember everyone and help the group'),
    (gen_random_uuid(), 'otter', 'Otter', 'ESFP', 'Playful & Energetic', 'Fun-loving and spontaneous, they bring joy to any situation'),
    (gen_random_uuid(), 'parrot', 'Parrot', 'ENFJ', 'Enthusiastic & Creative', 'Inspiring leaders who encourage others to be their best'),
    (gen_random_uuid(), 'border-collie', 'Border Collie', 'ENTJ', 'Leadership & Goal-oriented', 'Natural leaders who organize and motivate teams to success')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- PART 3: MAPPING REFERENCE
-- ============================================

-- This shows which genius type each animal should map to
-- Use this reference when updating student records:
/*
Animal → Primary Genius Type Mapping:
- Meerkat (MEE) → Creative Genius
- Panda (PAN) → Analytical Genius  
- Owl (OWL) → Analytical Genius
- Beaver (BEA) → Practical Genius
- Elephant (ELE) → Social Genius
- Otter (OTT) → Creative Genius (playful creativity)
- Parrot (PAR) → Creative Genius
- Border Collie (BDC) → Practical Genius (leadership is practical)
*/

-- ============================================
-- PART 4: MIGRATION HELPER
-- ============================================

-- To migrate existing students to use the lookup tables:
-- This query shows how to update students based on their passport codes
/*
UPDATE students s
SET 
    animal_type_id = at.id,
    genius_type_id = CASE 
        WHEN at.code IN ('meerkat', 'parrot', 'otter') THEN 
            (SELECT id FROM genius_types WHERE code = 'creative')
        WHEN at.code IN ('panda', 'owl') THEN 
            (SELECT id FROM genius_types WHERE code = 'analytical')
        WHEN at.code IN ('beaver', 'border-collie') THEN 
            (SELECT id FROM genius_types WHERE code = 'practical')
        WHEN at.code = 'elephant' THEN 
            (SELECT id FROM genius_types WHERE code = 'social')
    END
FROM animal_types at
WHERE 
    s.passport_code LIKE UPPER(SUBSTRING(at.code, 1, 3)) || '-%'
    AND s.animal_type_id IS NULL;
*/

-- ============================================
-- PART 5: VERIFICATION QUERIES
-- ============================================

-- Verify animal codes match passport prefixes
SELECT 'Animal code prefixes for passport matching:' as info;
SELECT 
    code,
    UPPER(SUBSTRING(code, 1, 3)) as passport_prefix,
    name
FROM animal_types
ORDER BY name;

-- Check foreign key constraints exist
SELECT 'Foreign key constraints:' as info;
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS references_table
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'students' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name IN ('animal_type_id', 'genius_type_id');
