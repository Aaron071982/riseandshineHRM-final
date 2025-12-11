# Database Schema Update Required

## Issue
The application is failing because the database schema is out of sync. We added:
- `AvailabilitySlot` model (new table)
- `scheduleCompleted` field to `RBTProfile` (new column)

These changes need to be applied to your production database.

## Solution: Push Schema to Production Database

Run this command locally with your production DATABASE_URL:

```bash
export DATABASE_URL="postgresql://postgres.yhxcqxivimjulxpchmxu:Comilla%401972@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"

npx prisma db push
```

This will:
1. Create the new `availability_slots` table
2. Add the `scheduleCompleted` column to `rbt_profiles` table
3. Update all indexes and constraints

## After Pushing Schema

1. **Verify the changes** (optional):
   ```bash
   npx prisma studio
   ```
   This opens a visual database browser - check that the new table and column exist.

2. **Redeploy on Vercel** (if needed):
   - The code is already deployed
   - Once the schema is updated, the app should work

## If You Still Get Errors

Check Vercel logs for specific error messages. The most common issues:
- Schema not pushed yet (run `npx prisma db push` above)
- Connection string issues (check VERCEL_DATABASE_FIX.md)
- Network restrictions on Supabase

## Quick Test

After pushing the schema, try accessing:
- `/admin/dashboard` - should load
- `/rbt/dashboard` - should load (if logged in as RBT)

