# Vercel Database Connection Fix (P1001 Error)

## Quick Fix: Update DATABASE_URL in Vercel

The P1001 error means Vercel can't reach your Supabase database. Since it was working before, try these steps:

### Option 1: Use Direct Connection (Recommended for Vercel)

1. Go to **Supabase Dashboard** → Your Project → **Settings** → **Database**
2. Scroll to **Connection string**
3. Select **URI** tab (NOT Session pooler)
4. Copy the **direct connection string** (looks like: `postgresql://postgres.xxxxx:password@db.xxxxx.supabase.co:5432/postgres`)
5. Go to **Vercel** → Your Project → **Settings** → **Environment Variables**
6. Update `DATABASE_URL` with the direct connection string
7. Add `?sslmode=require` at the end if not present
8. **Redeploy** your project

### Option 2: Fix Session Pooler Connection String

If you want to keep using Session Pooler, update your `DATABASE_URL` in Vercel to:

```
postgresql://postgres.yhxcqxivimjulxpchmxu:Comilla%401972@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require&pgbouncer=true&connection_limit=1
```

**Key parameters added:**
- `pgbouncer=true` - Tells Prisma this is a connection pooler
- `connection_limit=1` - Limits connections per serverless function (critical for Vercel)

### Option 3: Check Supabase Network Restrictions

1. Go to **Supabase Dashboard** → Your Project → **Settings** → **Database**
2. Scroll to **Network Restrictions**
3. Make sure it's set to **Allow all IPs** (0.0.0.0/0)
4. If you have IP restrictions, add Vercel's IP ranges or remove restrictions

### Option 4: Verify Database is Running

1. Go to **Supabase Dashboard** → Your Project
2. Check if the database shows as **Active**
3. If paused, click **Restore** or **Resume**

## After Making Changes

1. **Redeploy** in Vercel (or wait for automatic redeploy)
2. Check Vercel logs for any new errors
3. Test the `/admin/dashboard` route

## Why This Happens

- Vercel serverless functions have connection limits
- Session Pooler needs specific parameters for Prisma
- Network restrictions can block Vercel IPs
- Database might be paused or have connectivity issues

## Still Not Working?

1. Check Vercel logs for the exact error
2. Verify `DATABASE_URL` is set correctly in Vercel (check for typos)
3. Try the direct connection string instead of pooler
4. Contact Supabase support if database appears down

