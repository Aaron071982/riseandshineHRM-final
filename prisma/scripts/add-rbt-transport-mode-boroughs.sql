-- RBT application: mode of transport (CAR | TRANSIT) + boroughs willing to travel to.
-- Idempotent; safe to run on prod and dev.
ALTER TABLE rbt_profiles ADD COLUMN IF NOT EXISTS "transportMode" TEXT;
ALTER TABLE rbt_profiles ADD COLUMN IF NOT EXISTS "travelBoroughsJson" JSONB;
