# Database Migration Instructions

## Quick Migration Guide

You have two options to apply the database schema changes:

### Option 1: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the entire contents of `database-migration.sql`
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. You should see "Success. No rows returned" messages

### Option 2: Using Prisma (Alternative)

If you prefer using Prisma migrations:

```bash
# Make sure your DATABASE_URL is set to production
export DATABASE_URL="your-production-connection-string"

# Push the schema changes
npx prisma db push

# Or create a migration
npx prisma migrate dev --name add_documents_and_interview_notes
```

### Verification

After running the migration, verify the tables were created:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('rbt_documents', 'interview_notes');

-- Check table structure
\d "rbt_documents"
\d "interview_notes"
```

### What This Migration Does

1. **Creates `rbt_documents` table**: Stores uploaded documents (resumes, certifications, etc.) for each RBT
2. **Creates `interview_notes` table**: Stores structured interview notes following the 11-section script
3. **Sets up foreign keys**: Ensures data integrity with cascade deletes
4. **Creates indexes**: Optimizes query performance

### Important Notes

- This migration is **safe to run multiple times** (uses `IF NOT EXISTS`)
- Existing data will **not** be affected
- The migration uses **CASCADE DELETE**, so if an RBT or Interview is deleted, related documents/notes will be automatically deleted too

### Troubleshooting

If you encounter any errors:

1. **"relation already exists"**: The table already exists, which is fine. The migration uses `IF NOT EXISTS`.
2. **"foreign key constraint fails"**: Make sure the `rbt_profiles` and `interviews` tables exist first.
3. **"permission denied"**: Make sure you're using an admin connection string, not the anon key.

### After Migration

Once the migration is complete:
- ✅ Document upload feature will work
- ✅ Interview notes feature will work
- ✅ All new features will be fully functional

