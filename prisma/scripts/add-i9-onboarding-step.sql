-- Compliance Task 1: Form I-9 onboarding step + hire date tracking.
-- Additive and idempotent. Existing staff default to I-9 incomplete (no backfill of I-9 timestamps).

ALTER TABLE rbt_profiles ADD COLUMN IF NOT EXISTS "hiredAt" TIMESTAMP(3);
ALTER TABLE rbt_profiles ADD COLUMN IF NOT EXISTS "i9Section1CompletedAt" TIMESTAMP(3);
ALTER TABLE rbt_profiles ADD COLUMN IF NOT EXISTS "i9Section2CompletedAt" TIMESTAMP(3);
ALTER TABLE rbt_profiles ADD COLUMN IF NOT EXISTS "i9Section2CompletedBy" TEXT;
ALTER TABLE rbt_profiles ADD COLUMN IF NOT EXISTS "i9Section2Notes" TEXT;

INSERT INTO onboarding_documents (
  id, title, slug, type, category, "flowType", tier, "stepNumber", "unlockGroup",
  "displayOrder", "sortOrder", folder, "isRequired", "isActive", "createdAt", "updatedAt"
)
VALUES (
  'onb_doc_i9_employment_eligibility',
  'Form I-9 (Employment Eligibility Verification)',
  'i9-employment-eligibility',
  'ACKNOWLEDGMENT',
  'DOWNLOAD_REUPLOAD',
  'UPLOAD',
  'ACTIVATION',
  33,
  'fillable_forms',
  33,
  33,
  'PERSONAL_DOCUMENTS',
  true,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO NOTHING;
