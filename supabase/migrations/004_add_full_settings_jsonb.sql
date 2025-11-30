-- Add full_settings JSONB column to store complete FamilySettings object
-- This allows us to store all settings fields without modifying the schema for each new field

ALTER TABLE public.family_settings
ADD COLUMN IF NOT EXISTS full_settings JSONB;

-- Create index for faster JSONB queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_family_settings_full_settings ON public.family_settings USING GIN(full_settings);

-- Backfill existing rows with empty JSONB object if needed
UPDATE public.family_settings
SET full_settings = '{}'::jsonb
WHERE full_settings IS NULL;
