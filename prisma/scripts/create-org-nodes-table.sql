-- Org chart / company hierarchy (matches prisma/schema.prisma model OrgNode).
-- Run on Supabase / Postgres if not using prisma migrate.

CREATE TABLE IF NOT EXISTS "org_nodes" (
  "id" TEXT PRIMARY KEY,
  "parentId" TEXT,
  "name" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "department" TEXT,
  "subDepartment" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "linkedUserId" TEXT,
  "avatarColor" TEXT NOT NULL DEFAULT '#f97316',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Safe to re-run: skip if constraint already exists (e.g. partial prior run).
DO $$ BEGIN
  ALTER TABLE "org_nodes"
    ADD CONSTRAINT "org_nodes_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "org_nodes"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "org_nodes"
    ADD CONSTRAINT "org_nodes_linkedUserId_fkey"
    FOREIGN KEY ("linkedUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "org_nodes_parentId_idx" ON "org_nodes"("parentId");
CREATE INDEX IF NOT EXISTS "org_nodes_linkedUserId_idx" ON "org_nodes"("linkedUserId");
CREATE INDEX IF NOT EXISTS "org_nodes_parentId_sortOrder_idx" ON "org_nodes"("parentId", "sortOrder");
CREATE INDEX IF NOT EXISTS "org_nodes_department_subDepartment_idx" ON "org_nodes"("department", "subDepartment");
