-- Migration: Add avatar color customization support
-- This migration documents the expected structure for avatar colors within the existing avatarData JSONB field

-- No schema changes needed since avatarData is already JSONB
-- This migration serves as documentation for the expected structure:
-- avatarData: {
--   equipped: { hat?: string, glasses?: string, accessory?: string },
--   colors: {
--     primaryColor: string | null,    -- Hex color for primary fur/feathers
--     secondaryColor: string | null,  -- Hex color for belly/accents
--     hasCustomized: boolean,         -- Whether student has gone through customization
--     customizedAt: timestamp         -- When they customized
--   }
-- }

-- Add comment to document the structure
COMMENT ON COLUMN students.avatar_data IS 'Avatar customization data including equipped items and color choices. Structure: {equipped: {hat, glasses, accessory}, colors: {primaryColor, secondaryColor, hasCustomized, customizedAt}}';
