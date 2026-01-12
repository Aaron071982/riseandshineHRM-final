# Database Migration Commands

## Apply Prisma Schema Changes

The schema has been updated with:
1. `ApplicationSource` enum
2. New fields on `RBTProfile` model
3. `CandidateApplicationDraft` table

### Option 1: Push schema directly (recommended for development)

```bash
npm run db:push
```

This will:
- Apply all schema changes to your database
- Create the `candidate_application_drafts` table
- Add new columns to `rbt_profiles` table
- Add the `ApplicationSource` enum type

### Option 2: Create a migration (recommended for production)

```bash
npm run db:migrate
```

When prompted, name the migration: `add_public_application_fields`

Then apply it:
```bash
npx prisma migrate deploy
```

### Verify Migration

After running the migration, verify the changes:

```sql
-- Check if CandidateApplicationDraft table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'candidate_application_drafts';

-- Check if new RBTProfile fields exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'rbt_profiles' 
AND column_name IN ('source', 'submittedAt', 'resumeUrl', 'resumeFileName', 'resumeMimeType', 'resumeSize', 'availabilityJson', 'languagesJson', 'experienceYears', 'transportation', 'preferredHoursRange');

-- Check if ApplicationSource enum exists
SELECT typname 
FROM pg_type 
WHERE typname = 'ApplicationSource';
```

### Generate Prisma Client

After migration, regenerate the Prisma client:

```bash
npm run db:generate
```

Or:

```bash
npx prisma generate
```
