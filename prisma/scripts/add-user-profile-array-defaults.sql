-- Optional: ensure user_profiles array columns accept creates without explicit values.
ALTER TABLE "user_profiles" ALTER COLUMN "skills" SET DEFAULT '{}';
ALTER TABLE "user_profiles" ALTER COLUMN "languages" SET DEFAULT '{}';

UPDATE "user_profiles" SET "skills" = '{}' WHERE "skills" IS NULL;
UPDATE "user_profiles" SET "languages" = '{}' WHERE "languages" IS NULL;

ALTER TABLE "user_profiles" ALTER COLUMN "skills" SET NOT NULL;
ALTER TABLE "user_profiles" ALTER COLUMN "languages" SET NOT NULL;
