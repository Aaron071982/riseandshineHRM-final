-- Client Management System tables (maps to Prisma model CrmClient / cms_clients).
-- Run in Supabase SQL Editor if not using prisma migrate. Does not touch compliance `clients` or `scheduling_clients`.

CREATE TABLE IF NOT EXISTS "cms_clients" (
  "id" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "dateOfBirth" DATE,
  "diagnosis" TEXT,
  "status" TEXT NOT NULL,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city" TEXT,
  "state" TEXT,
  "zipCode" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "insuranceProvider" TEXT,
  "insuranceMemberId" TEXT,
  "insuranceGroupNumber" TEXT,
  "insurancePhone" TEXT,
  "authorizationNumber" TEXT,
  "authorizationStartDate" DATE,
  "authorizationEndDate" DATE,
  "authorizedHoursPerWeek" DOUBLE PRECISION,
  "usedHoursTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "guardianName" TEXT,
  "guardianPhone" TEXT,
  "guardianEmail" TEXT,
  "guardianRelationship" TEXT,
  "preferredLanguage" TEXT,
  "preferredRbtGender" TEXT,
  "preferredRbtEthnicity" TEXT,
  "intakeDate" DATE,
  "firstSessionDate" DATE,
  "notes" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cms_clients_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cms_clients_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "cms_clients_status_idx" ON "cms_clients"("status");
CREATE INDEX IF NOT EXISTS "cms_clients_authorizationEndDate_idx" ON "cms_clients"("authorizationEndDate");
CREATE INDEX IF NOT EXISTS "cms_clients_createdByUserId_idx" ON "cms_clients"("createdByUserId");

CREATE TABLE IF NOT EXISTS "client_rbt_assignments" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "rbtProfileId" TEXT NOT NULL,
  "assignedByUserId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "startDate" DATE,
  "endDate" DATE,
  "daysOfWeek" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "timeStart" TEXT,
  "timeEnd" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_rbt_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "client_rbt_assignments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "cms_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "client_rbt_assignments_rbtProfileId_fkey" FOREIGN KEY ("rbtProfileId") REFERENCES "rbt_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "client_rbt_assignments_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "client_rbt_assignments_clientId_idx" ON "client_rbt_assignments"("clientId");
CREATE INDEX IF NOT EXISTS "client_rbt_assignments_rbtProfileId_idx" ON "client_rbt_assignments"("rbtProfileId");
CREATE INDEX IF NOT EXISTS "client_rbt_assignments_status_idx" ON "client_rbt_assignments"("status");

CREATE TABLE IF NOT EXISTS "client_bcba_assignments" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "bcbaProfileId" TEXT NOT NULL,
  "assignedByUserId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT true,
  "startDate" DATE,
  "endDate" DATE,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_bcba_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "client_bcba_assignments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "cms_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "client_bcba_assignments_bcbaProfileId_fkey" FOREIGN KEY ("bcbaProfileId") REFERENCES "bcba_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "client_bcba_assignments_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "client_bcba_assignments_clientId_idx" ON "client_bcba_assignments"("clientId");
CREATE INDEX IF NOT EXISTS "client_bcba_assignments_bcbaProfileId_idx" ON "client_bcba_assignments"("bcbaProfileId");

CREATE TABLE IF NOT EXISTS "client_notes" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "noteType" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "client_notes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "cms_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "client_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "client_notes_clientId_idx" ON "client_notes"("clientId");
CREATE INDEX IF NOT EXISTS "client_notes_authorId_idx" ON "client_notes"("authorId");

CREATE TABLE IF NOT EXISTS "client_status_history" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "changedByUserId" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_status_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "client_status_history_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "cms_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "client_status_history_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "client_status_history_clientId_idx" ON "client_status_history"("clientId");
CREATE INDEX IF NOT EXISTS "client_status_history_createdAt_idx" ON "client_status_history"("createdAt");
