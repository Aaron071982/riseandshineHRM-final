-- Add latitude/longitude to rbt_profiles for RBT Proximity Finder.
-- Run this if prisma migrate failed (e.g. shadow DB issue).
ALTER TABLE rbt_profiles ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE rbt_profiles ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
