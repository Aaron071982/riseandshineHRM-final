-- Saved Operations query definitions (filter JSON only — never PHI).
CREATE TYPE "SavedQueryShareScope" AS ENUM ('PRIVATE', 'ROLE', 'FULL_ACCESS');

CREATE TABLE IF NOT EXISTS "saved_queries" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "filterJson" JSONB NOT NULL,
  "columnsJson" JSONB,
  "shareScope" "SavedQueryShareScope" NOT NULL DEFAULT 'PRIVATE',
  "sharedWithRole" "CrmRole",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saved_queries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "saved_queries_ownerUserId_idx" ON "saved_queries"("ownerUserId");
CREATE INDEX IF NOT EXISTS "saved_queries_shareScope_sharedWithRole_idx" ON "saved_queries"("shareScope", "sharedWithRole");

ALTER TABLE "saved_queries"
  ADD CONSTRAINT "saved_queries_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
