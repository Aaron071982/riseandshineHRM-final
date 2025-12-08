# Vercel Database Connection Fix (P1001 Error)

## Important: Use Session Pooler (Not Direct Connection)

**Direct connection is NOT IPv4 compatible** - Vercel requires IPv4, so you MUST use Session Pooler or Transaction Pooler.

## Quick Fix: Update DATABASE_URL in Vercel

The P1001 error means Vercel can't reach your Supabase database. Follow these steps:

### Option 1: Use Transaction Pooler (Recommended for Vercel Serverless)

**Best for serverless environments like Vercel!**

1. Go to **Supabase Dashboard** → Your Project → **Settings** → **Database**
2. Scroll to **Connection string**
3. Select **Session pooler** tab
4. Change **Method** dropdown to **Transaction mode** (port 6543)
5. Copy the connection string
6. Go to **Vercel** → Your Project → **Settings** → **Environment Variables**
7. Update `DATABASE_URL` with the Transaction Pooler connection string
8. It should look like: `postgresql://postgres.yhxcqxivimjulxpchmxu:Comilla%401972@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require`
9. **Redeploy** your project

**Note:** Transaction Pooler uses port **6543** (not 5432)

### Option 2: Use Session Pooler (Also Works)

If Transaction Pooler doesn't work, use Session Pooler:

1. Go to **Supabase Dashboard** → Your Project → **Settings** → **Database**
2. Select **Session pooler** tab
3. Keep **Method** as **Session mode** (port 5432)
4. Copy the connection string
5. Update `DATABASE_URL` in Vercel to:

```
postgresql://postgres.yhxcqxivimjulxpchmxu:Comilla%401972@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require&pgbouncer=true&connection_limit=1
```

**Key parameters:**
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

## Direct Connection vs Session Pooler

**Direct Connection:**
- ❌ **NOT IPv4 compatible** - Won't work with Vercel
- ✅ Lower latency for persistent connections
- ✅ Supports all PostgreSQL features
- Best for: VMs, long-running containers

**Session Pooler:**
- ✅ **IPv4 compatible** - Works with Vercel
- ✅ Supports prepared statements
- ✅ Connection assigned per session
- Best for: Applications needing persistent connections on IPv4

**Transaction Pooler (Recommended for Vercel):**
- ✅ **IPv4 compatible** - Works with Vercel
- ✅ Optimized for serverless (short-lived connections)
- ⚠️ Doesn't support prepared statements (but Prisma handles this)
- Best for: **Vercel, AWS Lambda, serverless functions**

## Still Not Working?

1. Check Vercel logs for the exact error
2. Verify `DATABASE_URL` is set correctly in Vercel (check for typos, port numbers)
3. Make sure you're using **Transaction Pooler (port 6543)** or **Session Pooler (port 5432)**
4. Verify Supabase network restrictions allow all IPs
5. Contact Supabase support if database appears down

