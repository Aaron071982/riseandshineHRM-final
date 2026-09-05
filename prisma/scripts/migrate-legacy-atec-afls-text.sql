-- Copy legacy AFLS text that was pasted into ATEC fields into the new AFLS keys.
-- This preserves the original ATEC keys and only touches records whose text
-- explicitly mentions AFLS.
UPDATE assessments
SET
  instruments = jsonb_set(
    jsonb_set(
      COALESCE(instruments, '{}'::jsonb),
      '{skillsAssessmentType}',
      '"AFLS"'::jsonb,
      true
    ),
    '{aflsAssessment}',
    to_jsonb(
      COALESCE(
        NULLIF(instruments->>'aflsAssessment', ''),
        NULLIF(instruments->>'atecAssessment', '')
      )
    ),
    true
  ),
  "presentLevels" = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE("presentLevels", '{}'::jsonb),
        '{afls,legacyMigratedFromAtec}',
        'true'::jsonb,
        true
      ),
      '{afls,interpretation}',
      to_jsonb(
        COALESCE(
          NULLIF("presentLevels"->'afls'->>'interpretation', ''),
          NULLIF("presentLevels"->'atec'->>'interpretation', ''),
          NULLIF(instruments->>'atecAssessment', '')
        )
      ),
      true
    ),
    '{atec}',
    COALESCE("presentLevels"->'atec', '{"date":"","interpretation":""}'::jsonb),
    true
  )
WHERE
  "deletedAt" IS NULL
  AND (
    COALESCE(instruments->>'atecAssessment', '') ILIKE '%AFLS%'
    OR COALESCE("presentLevels"->'atec'->>'interpretation', '') ILIKE '%AFLS%'
  );
