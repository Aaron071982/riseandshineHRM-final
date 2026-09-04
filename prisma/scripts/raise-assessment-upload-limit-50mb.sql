-- Ensure assessment / PHI document buckets accept files up to 50 MB.
UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id IN ('assessment-files', 'onboarding-documents');
