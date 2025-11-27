# Database Setup Guide

You need a PostgreSQL database. Here are your options:

## Option 1: Supabase (Recommended - Free & Easy)

### Step 1: Create Supabase Account
1. Go to https://supabase.com
2. Click "Start your project" and sign up (free)
3. Create a new project:
   - Name: `riseandshinehrm`
   - Database Password: (create a strong password - save it!)
   - Region: Choose closest to you
   - Wait 2-3 minutes for setup

### Step 2: Get Connection String
1. In your Supabase project dashboard
2. Go to **Settings** → **Database**
3. Scroll down to "Connection string"
4. Select **URI** tab
5. Copy the connection string (looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`)
6. Replace `[YOUR-PASSWORD]` with the password you created

### Step 3: Update .env File
```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres"
```

### Step 4: Push Schema & Seed
```bash
npm run db:push
npm run db:seed
```

Done! ✅

---

## Option 2: Install PostgreSQL Locally

### macOS:
```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install PostgreSQL
brew install postgresql@14

# Start PostgreSQL
brew services start postgresql@14

# Create database
createdb riseandshinehrm

# Update .env
DATABASE_URL="postgresql://$(whoami)@localhost:5432/riseandshinehrm"
```

### Then:
```bash
npm run db:push
npm run db:seed
```

---

## Option 3: Use Docker (if you install Docker Desktop)

```bash
# Run PostgreSQL in Docker
docker run --name riseandshine-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=riseandshinehrm \
  -p 5432:5432 -d postgres:14

# Update .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/riseandshinehrm"
```

Then:
```bash
npm run db:push
npm run db:seed
```

---

## Quick Start with Supabase (Easiest!)

1. **Create account**: https://supabase.com
2. **Create project** → Wait 2-3 min
3. **Get connection string**: Settings → Database → Connection string (URI)
4. **Update `.env`** file with connection string
5. **Run**: `npm run db:push` then `npm run db:seed`
6. **Done!** ✅

Your server is already running - just refresh the page after setting up the database!

