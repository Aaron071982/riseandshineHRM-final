-- Add borough to schedule clients for export grouping.
ALTER TABLE "schedule_client" ADD COLUMN IF NOT EXISTS "borough" TEXT;
CREATE INDEX IF NOT EXISTS "schedule_client_borough_idx" ON "schedule_client"("borough");
