# Vercel Production Debugging Guide

## Problem: RBT Dashboard 500 Error

If you're seeing a generic "Application error: a server-side exception has occurred" on `/rbt/dashboard` in production, follow these steps to identify and fix the root cause.

---

## Step 1: Access Vercel Deployment Logs

1. **Go to Vercel Dashboard**
   - Navigate to https://vercel.com/dashboard
   - Select your `riseandshineHRM` project

2. **Open the Latest Deployment**
   - Click on **"Deployments"** in the top navigation
   - Find the most recent production deployment (marked with a checkmark)
   - Click on it to view details

3. **View Function Logs**
   - Click on the **"Functions"** tab
   - Look for functions related to `/rbt/dashboard` (usually named something like `app/rbt/dashboard/page`)
   - Or click on **"Logs"** tab and filter/search for:
     - `rbt/dashboard`
     - `RBT Dashboard Error`
     - `Prisma Error`
     - The error digest number if shown (e.g., `4093131298`)

---

## Step 2: Identify the Error Type

Based on the logs, identify which type of error you're seeing:

### Type A: DATABASE_URL Missing
**Look for:**
```
DATABASE_URL environment variable is not set
```

**Fix:**
1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add `DATABASE_URL` with your Supabase connection string
3. Make sure it's set for **Production** environment
4. Redeploy

---

### Type B: Prisma Connection Error (P1001)
**Look for:**
```
PrismaClientKnownRequestError
code: 'P1001'
Can't reach database server
```

**Common causes:**
1. **Incorrect DATABASE_URL format**
   - Session Pooler: `postgresql://...pooler.supabase.com:5432/postgres?sslmode=require&pgbouncer=true&connection_limit=1`
   - Transaction Pooler: `postgresql://...pooler.supabase.com:6543/postgres?sslmode=require&connection_limit=1`

2. **Supabase Network Restrictions**
   - Go to **Supabase Dashboard** → Settings → Database
   - Check **Network Restrictions** allow all IPs (0.0.0.0/0)

3. **Database server down**
   - Check Supabase project status

**Fix:**
- Verify `DATABASE_URL` in Vercel matches one of the formats above
- Ensure Supabase network allows all IPs
- See `VERCEL_DATABASE_FIX.md` for detailed steps

---

### Type C: Prisma Schema Mismatch
**Look for:**
```
Invalid prisma... invocation
Value 'X' not found in enum
```

**Fix:**
1. Run database migrations:
   ```bash
   export DATABASE_URL="your-production-url"
   npx prisma migrate deploy
   ```
2. Or apply schema changes manually via Supabase SQL Editor

---

### Type D: Session Validation Error
**Look for:**
```
Session validation failed
```

**Fix:**
- This usually indicates a database connection issue (see Type B)
- Or expired/invalid session tokens

---

### Type E: Missing Environment Variables
**Look for:**
```
Environment check: { hasDatabaseUrl: false, ... }
```

**Fix:**
- Add missing environment variables in Vercel Settings → Environment Variables
- Required variables:
  - `DATABASE_URL`
  - `RESEND_API_KEY` (for emails)
  - `EMAIL_FROM` (for emails)

---

## Step 3: Understanding the Log Format

The enhanced error logging outputs structured JSON logs like:

```json
{
  "context": "Failed to fetch onboarding tasks",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/rbt/dashboard",
  "type": "PrismaClientKnownRequestError",
  "prismaCode": "P1001",
  "prismaMeta": {
    "database_host": "aws-1-us-east-1.pooler.supabase.com",
    "database_port": 5432
  },
  "category": "prisma_known_error"
}
```

This makes it easy to:
- Search logs by error code
- Identify the exact failure point
- See timestamps for correlation

---

## Step 4: Quick Checks Before Checking Logs

1. **Verify Environment Variables in Vercel**
   - Settings → Environment Variables
   - Ensure `DATABASE_URL` is set for **Production**

2. **Test Database Connectivity**
   ```bash
   export DATABASE_URL="your-production-url"
   npx prisma db push --skip-generate
   ```

3. **Check Supabase Status**
   - Supabase Dashboard → Project status should be "Healthy"

---

## Step 5: After Fixing

Once you've identified and fixed the issue:

1. **Redeploy**
   - Either push a new commit, or
   - Go to Vercel → Deployments → Click "..." → "Redeploy"

2. **Test the Route**
   - Visit `/rbt/dashboard` in production
   - If it still fails, check logs again for new errors

3. **Monitor Logs**
   - Keep the Vercel logs tab open while testing
   - Watch for any new error messages

---

## Common Error Patterns

### Pattern 1: Works Locally, Fails in Production
**Cause:** Missing environment variables in Vercel
**Solution:** Add env vars in Vercel Settings → Environment Variables

### Pattern 2: Intermittent Connection Errors
**Cause:** Connection pooling issues or network timeouts
**Solution:** Use Transaction Pooler (port 6543) or add connection parameters

### Pattern 3: Generic 500 with No Logs
**Cause:** Error happening before logging
**Solution:** Check Vercel build logs, not runtime logs

---

## Getting Help

If you're still stuck:

1. **Collect Information:**
   - Copy the full error log from Vercel
   - Note which environment (Production/Preview)
   - Check if it works locally

2. **Check Documentation:**
   - `VERCEL_DATABASE_FIX.md` - Database connection issues
   - `DATABASE_SCHEMA_UPDATE.md` - Schema migration issues

3. **Verify Setup:**
   - DATABASE_URL format is correct
   - All env vars are set in Vercel
   - Supabase network restrictions allow all IPs

---

## Example: Full Debugging Flow

```bash
# 1. Check Vercel logs → See "P1001" error

# 2. Verify DATABASE_URL in Vercel Settings
#    Format: postgresql://...pooler.supabase.com:5432/postgres?sslmode=require&pgbouncer=true&connection_limit=1

# 3. Check Supabase Network Restrictions
#    Should allow: 0.0.0.0/0

# 4. Test locally with production URL
export DATABASE_URL="postgresql://...pooler.supabase.com:5432/postgres?sslmode=require"
npx prisma db push --skip-generate

# 5. If local works, issue is likely network/timeout
#    Switch to Transaction Pooler (port 6543) or add connect_timeout

# 6. Redeploy on Vercel and test again
```

---

**Last Updated:** After adding comprehensive error handling to RBT dashboard
