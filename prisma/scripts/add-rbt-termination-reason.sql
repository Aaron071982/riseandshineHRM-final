-- Store why an RBT was terminated (fired).
ALTER TABLE "rbt_profiles"
  ADD COLUMN IF NOT EXISTS "terminationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "terminatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "terminatedBy" TEXT;
