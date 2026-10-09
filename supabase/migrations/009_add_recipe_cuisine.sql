-- Migration: recipe cuisine (issue #84)
-- AI-generated, photo and URL recipes now carry a cuisine (one of the
-- CUISINE_OPTIONS ids in apps/web/src/lib/types/settings.ts), which used to
-- be discarded. Nullable: recipes saved earlier have none and still load.
--
-- Run this BEFORE deploying #84's code: saving a recipe writes this column
-- and fails if it doesn't exist.

ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS cuisine TEXT;
