-- Cached geocode pins for service client addresses (Therapist & Client Map).
ALTER TABLE service_clients ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE service_clients ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
