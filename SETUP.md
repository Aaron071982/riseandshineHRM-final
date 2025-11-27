# Quick Setup Guide

## Database Setup Required

The application is starting, but you need to set up PostgreSQL first. Here are your options:

### Option 1: Local PostgreSQL

1. **Install PostgreSQL** (if not already installed):
   - macOS: `brew install postgresql@14`
   - Or download from: https://www.postgresql.org/download/

2. **Start PostgreSQL**:
   ```bash
   # macOS with Homebrew
   brew services start postgresql@14
   
   # Or manually
   pg_ctl -D /usr/local/var/postgres start
   ```

3. **Create the database**:
   ```bash
   createdb riseandshinehrm
   ```

4. **Update .env file** if your PostgreSQL credentials are different:
   ```env
   DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/riseandshinehrm?schema=public"
   ```

5. **Push schema and seed**:
   ```bash
   npm run db:push
   npm run db:seed
   ```

### Option 2: Use Supabase (Cloud PostgreSQL)

1. **Create a free Supabase account**: https://supabase.com

2. **Create a new project**

3. **Get your connection string** from Supabase dashboard → Settings → Database

4. **Update .env file**:
   ```env
   DATABASE_URL="your-supabase-connection-string"
   ```

5. **Push schema and seed**:
   ```bash
   npm run db:push
   npm run db:seed
   ```

### Option 3: Use Docker PostgreSQL

```bash
docker run --name riseandshine-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=riseandshinehrm -p 5432:5432 -d postgres:14

# Then update .env and run:
npm run db:push
npm run db:seed
```

## After Database Setup

Once your database is set up and seeded:

1. **Visit**: http://localhost:3000
2. **Login with admin phone**: `3473090431`
3. **Check console** for OTP code (in dev mode, SMS codes are logged)

## Default Admin Users (after seeding)

- **Aaron**: 3473090431
- **Kazi**: 5551234567  
- **Tisha**: 5559876543

OTP codes will be displayed in the terminal/console in development mode.

