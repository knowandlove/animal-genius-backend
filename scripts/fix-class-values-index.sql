-- Fix for the unique_session_value_normalized index issue
-- This drops and recreates the problematic index

-- First, check if the problematic index exists
DO $$
BEGIN
    -- Drop the problematic index if it exists
    IF EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'class_values' 
        AND indexname = 'unique_session_value_normalized'
    ) THEN
        DROP INDEX IF EXISTS unique_session_value_normalized;
        RAISE NOTICE 'Dropped problematic index: unique_session_value_normalized';
    END IF;
    
    -- Create the correct index if the table exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'class_values_votes'
    ) THEN
        -- Create unique index for class values votes if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_indexes 
            WHERE tablename = 'class_values_votes' 
            AND indexname = 'unique_session_student_cluster_rank'
        ) THEN
            CREATE UNIQUE INDEX unique_session_student_cluster_rank 
            ON class_values_votes(session_id, student_id, cluster_number, vote_rank);
            RAISE NOTICE 'Created index: unique_session_student_cluster_rank';
        END IF;
    END IF;
END $$;