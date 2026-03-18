-- Migration: night_time_hrs column
-- Run in Supabase SQL Editor for the live DB

ALTER TABLE public.flights
  ADD COLUMN IF NOT EXISTS night_time_hrs NUMERIC(5,2);
