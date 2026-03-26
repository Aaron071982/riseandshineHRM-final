CREATE TABLE IF NOT EXISTS "scheduling_exclusions" (
  "id" TEXT PRIMARY KEY,
  "rbtProfileId" TEXT NOT NULL,
  "excludedByUserId" TEXT NOT NULL,
  "reason" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "scheduling_exclusions"
  ADD CONSTRAINT "scheduling_exclusions_rbtProfileId_fkey"
  FOREIGN KEY ("rbtProfileId") REFERENCES "rbt_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scheduling_exclusions"
  ADD CONSTRAINT "scheduling_exclusions_excludedByUserId_fkey"
  FOREIGN KEY ("excludedByUserId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "scheduling_exclusions_rbtProfileId_idx"
  ON "scheduling_exclusions"("rbtProfileId");

CREATE INDEX IF NOT EXISTS "scheduling_exclusions_excludedByUserId_idx"
  ON "scheduling_exclusions"("excludedByUserId");

CREATE INDEX IF NOT EXISTS "scheduling_exclusions_expiresAt_idx"
  ON "scheduling_exclusions"("expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "scheduling_exclusions_rbtProfileId_key"
  ON "scheduling_exclusions"("rbtProfileId");
