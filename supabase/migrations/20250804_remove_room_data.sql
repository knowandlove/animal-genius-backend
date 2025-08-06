-- Remove room_data column from students table since we've migrated to garden system
ALTER TABLE students DROP COLUMN IF EXISTS room_data;