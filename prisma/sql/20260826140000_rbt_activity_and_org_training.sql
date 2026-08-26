-- Part A: RBT activity state (additive, default ACTIVE)
CREATE TYPE "RbtActivityState" AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE "rbt_profiles"
  ADD COLUMN IF NOT EXISTS "activityState" "RbtActivityState" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "inactiveReason" TEXT,
  ADD COLUMN IF NOT EXISTS "inactiveUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "inactiveSetByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "inactiveSetAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "rbt_profiles_activityState_idx" ON "rbt_profiles"("activityState");

-- Part B: Org-wide training modules
CREATE TYPE "OrgTrainingModuleStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "OrgTrainingItemType" AS ENUM ('VIDEO_EMBED', 'EXTERNAL_LINK', 'FILE', 'READING');
CREATE TYPE "OrgTrainingEvidenceType" AS ENUM ('ATTESTATION', 'QUIZ_PASS');

CREATE TABLE IF NOT EXISTS "org_training_modules" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "audienceRoles" TEXT[],
  "required" BOOLEAN NOT NULL DEFAULT true,
  "status" "OrgTrainingModuleStatus" NOT NULL DEFAULT 'ACTIVE',
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "org_training_modules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "org_training_module_items" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "type" "OrgTrainingItemType" NOT NULL,
  "title" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "embedUrl" TEXT,
  "externalUrl" TEXT,
  "storageObjectPath" TEXT,
  "richTextContent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "org_training_module_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "org_training_quizzes" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "questionsJson" JSONB NOT NULL,
  "passThreshold" INTEGER NOT NULL DEFAULT 8,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "org_training_quizzes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "org_training_completions" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "evidenceType" "OrgTrainingEvidenceType" NOT NULL,
  "attestationText" TEXT,
  "quizScore" INTEGER,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  CONSTRAINT "org_training_completions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "org_training_quizzes_moduleId_key" ON "org_training_quizzes"("moduleId");
CREATE UNIQUE INDEX IF NOT EXISTS "org_training_completions_moduleId_userId_key" ON "org_training_completions"("moduleId", "userId");
CREATE INDEX IF NOT EXISTS "org_training_modules_status_displayOrder_idx" ON "org_training_modules"("status", "displayOrder");
CREATE INDEX IF NOT EXISTS "org_training_module_items_moduleId_position_idx" ON "org_training_module_items"("moduleId", "position");
CREATE INDEX IF NOT EXISTS "org_training_completions_userId_idx" ON "org_training_completions"("userId");
CREATE INDEX IF NOT EXISTS "org_training_completions_moduleId_idx" ON "org_training_completions"("moduleId");

DO $$ BEGIN
  ALTER TABLE "org_training_modules" ADD CONSTRAINT "org_training_modules_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "org_training_module_items" ADD CONSTRAINT "org_training_module_items_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "org_training_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "org_training_quizzes" ADD CONSTRAINT "org_training_quizzes_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "org_training_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "org_training_completions" ADD CONSTRAINT "org_training_completions_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "org_training_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "org_training_completions" ADD CONSTRAINT "org_training_completions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
