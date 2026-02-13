# Scheduling System (beta) – Overview & Production Readiness

## What it does

- **Admin-only** tab: "Scheduling System (beta)" (dev or when `NEXT_PUBLIC_SCHEDULING_BETA=true`).
- **RBTs**: Lists HIRED RBTs from the HRM; used for matching and assignment.
- **Clients**: Add clients in-memory (name, address, zip, optional preferred RBT ethnicity).
- **Find 3 closest RBTs**: Haversine distance from client zip (NYC-area) + optional ethnicity filter.
- **Map**: Google Maps with RBT and client markers; driving route and drive time when you pick a match (requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`).
- **Assign RBT to client**: Multiple days + time range (e.g. Mon/Tue/Wed 4–7 PM). Assign and remove assignments.
- **RBT profile**: Shows "Client assignments" for that RBT when assignments are stored in the DB.

## Current state vs production

| Feature | Beta (current) | Production |
|--------|-----------------|------------|
| RBTs | From DB (HIRED) | Same |
| Clients | In-memory only (lost on refresh) | Stored in `scheduling_clients` |
| Assignments | In-memory only | Stored in `client_assignments` |
| Map | Works with API key | Same |
| RBT profile assignments | Fetched from API when DB in use | Same |

## Database (production)

Two new tables:

- **scheduling_clients** – Clients used for scheduling (name, address, zip, preferred RBT ethnicity).
- **client_assignments** – RBT–client schedule: which days (0–6) and time range (timeStart/timeEnd) plus optional notes.

Run migrations or the SQL below, then use the APIs to persist clients and assignments.

## Environment

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` – Same value as `GOOGLE_MAPS_API_KEY` so the map loads in the browser.
- `NEXT_PUBLIC_SCHEDULING_BETA` – Set to `true` to show the Scheduling (beta) tab in production.

## Production checklist

1. Run Prisma migration (or raw SQL below) to create `scheduling_clients` and `client_assignments`.
2. Ensure admin session/auth is required for all scheduling-beta and assignment APIs.
3. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (and optionally `NEXT_PUBLIC_SCHEDULING_BETA`) in production env.
4. (Optional) Add client CRUD UI to persist clients; beta can keep in-memory clients for quick testing while assignments persist to DB.

## Raw SQL (copy-paste)

If you prefer to run SQL by hand instead of Prisma migrate, copy the script from **`docs/scheduling_tables.sql`** into your database (e.g. Supabase SQL editor), or run:

```sql
CREATE TABLE IF NOT EXISTS scheduling_clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  "preferredRbtEthnicity" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS client_assignments (
  id TEXT PRIMARY KEY,
  "rbtProfileId" TEXT NOT NULL REFERENCES rbt_profiles(id) ON DELETE CASCADE,
  "schedulingClientId" TEXT NOT NULL REFERENCES scheduling_clients(id) ON DELETE CASCADE,
  "daysOfWeek" INTEGER[] NOT NULL,
  "timeStart" TEXT,
  "timeEnd" TEXT,
  notes TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_client_assignments_rbt ON client_assignments("rbtProfileId");
CREATE INDEX IF NOT EXISTS idx_client_assignments_client ON client_assignments("schedulingClientId");
```

Then run `npx prisma generate`. Note: Prisma generates `id` with `cuid()` when creating rows via the API; if you insert by hand you must supply valid IDs.
