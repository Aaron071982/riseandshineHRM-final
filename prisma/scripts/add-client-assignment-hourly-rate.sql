-- RBT hourly rate per client assignment (USD). Safe to run on existing DBs.
ALTER TABLE "client_assignments" ADD COLUMN IF NOT EXISTS "hourlyRate" DECIMAL(10,2);
