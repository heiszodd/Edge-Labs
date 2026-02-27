-- Add dedicated JSON metadata for perps models.
-- Run this in Supabase SQL Editor after step1 schema.

ALTER TABLE public.models
    ADD COLUMN IF NOT EXISTS model_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

