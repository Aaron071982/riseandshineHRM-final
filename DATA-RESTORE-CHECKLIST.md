# Get All Your Data Back on Rise and Shine HRM

Your data is in Supabase. Follow these steps so the app can read it everywhere (dashboard, RBTs, interviews, onboarding).

---

## Step 1: Run the migration in Supabase (required)

1. Open **Supabase**: https://supabase.com/dashboard  
2. Select the project **RiseAndShine-hrm-prod** (the one with your data).
3. Go to **SQL Editor** → **New query**.
4. Open the file **`prisma/supabase-migrations.sql`** in your repo and **copy the entire file**.
5. Paste it into the Supabase SQL Editor and click **Run**.
6. You should see **Success** (and possibly “No rows returned” for some statements—that’s normal).

This adds any missing columns on `rbt_profiles` (and other tables) so the app can read your data.

---

## Step 2: Use the same database in production (Vercel)

1. In **Vercel**: your project → **Settings** → **Environment Variables**.
2. Find **`DATABASE_URL`** (or add it for Production/Preview if missing).
3. Set it to the **same** Supabase connection string you use locally:
   - In Supabase: **Project Settings** → **Database** → **Connection string** → **URI**.
   - Choose **Session pooler** (port **5432**).
   - Replace `[YOUR-PASSWORD]` with your real DB password.
   - Add `?sslmode=require` at the end.
   - Example:  
     `postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require`
4. **Redeploy** the app (e.g. trigger a new deployment or push a commit) so the new env is used.

---

## Step 3: Refresh the app

1. Open your **production** app URL (e.g. your Vercel URL).
2. **Hard refresh**: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows).
3. Log in as admin and check:
   - **Dashboard** – counts and lists
   - **RBTs & Candidates** – candidate list
   - **Interviews** – interview list
   - **Onboarding** – hired RBTs and progress

---

## If something is still empty

- Open **`/api/debug/db-counts`** on your **production** URL (e.g. `https://your-app.vercel.app/api/debug/db-counts`).
- Check the JSON:
  - **`rbt_profiles_raw_count`** > 0 → app is connected to the right DB; if Prisma still fails, run the migration again (Step 1).
  - **`rbt_profiles_raw_count`** = 0 → production is likely using a different DB; fix **`DATABASE_URL`** in Vercel (Step 2).

---

## Summary

| Step | What to do |
|------|------------|
| 1 | Run **entire** `prisma/supabase-migrations.sql` in Supabase SQL Editor (same project as your data). |
| 2 | Set **`DATABASE_URL`** in Vercel to that same Supabase project (Session pooler, with password and `?sslmode=require`). |
| 3 | Redeploy, then hard refresh the app and check Dashboard, RBTs, Interviews, Onboarding. |

No data is deleted by these steps; they only fix schema and connection so the app can read what’s already there.

---

## After adding new columns in Prisma

If you change `prisma/schema.prisma` (e.g. add a column like `filePath`), production can throw P2022 ("column does not exist") until the DB is updated. Run the matching `ALTER TABLE` (or add a new section to `prisma/supabase-migrations.sql` and run that file) in the **same** Supabase project as your production `DATABASE_URL`, then redeploy if needed.
