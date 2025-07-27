-- Script to inspect mystery tables in the database
-- Run this in Supabase SQL Editor to understand what data we have

-- Check if these tables exist and what data they contain
SELECT 'lessons' as table_name, COUNT(*) as row_count FROM lessons
UNION ALL
SELECT 'animals' as table_name, COUNT(*) as row_count FROM animals  
UNION ALL
SELECT 'item_metadata' as table_name, COUNT(*) as row_count FROM item_metadata
UNION ALL
SELECT 'quiz_answer_types' as table_name, COUNT(*) as row_count FROM quiz_answer_types;

-- Show structure of lessons table if it exists
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'lessons'
ORDER BY ordinal_position;

-- Show structure of animals table if it exists  
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'animals'
ORDER BY ordinal_position;

-- Show structure of item_metadata table if it exists
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'item_metadata'
ORDER BY ordinal_position;

-- Show structure of quiz_answer_types table if it exists
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'quiz_answer_types'
ORDER BY ordinal_position;

-- List all tables in public schema to see what else might be there
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;