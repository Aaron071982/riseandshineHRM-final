# How mobile clock-out and notes get into HRM Attendance

## Short answer

**Yes.** With the three keys set in the app (`HRM_BASE_URL`, `MOBILE_SYNC_SECRET`, `HRM_RBT_PROFILE_ID`), when you **clock out** (and optionally add notes), the app is supposed to **send one HTTP POST** to the HRM. The **HRM** then writes that data into **its** database (the same Supabase/Postgres the HRM app uses). The **Attendance & Hours** page reads from that same database. So:

- If the POST **succeeds** → the HRM stores the time entry (and session note if sent) → it **will** show in Attendance.
- If nothing shows in Attendance → the POST either never ran, didn’t reach the HRM, or failed (401/404/400).

The mobile app **does not** write directly to the database. It only calls the HRM API. The HRM server does the database writes.

---

## Flow (current design)

```
Mobile app (clock out + notes)
    → POST to {HRM_BASE_URL}/api/mobile/sync/time-entry
    → HRM API checks MOBILE_SYNC_SECRET, validates body
    → HRM inserts/updates time_entries + session_notes in its DB
    → HRM Attendance page reads time_entries + session_notes from same DB
```

So: **keys in the app** = app can call the API. **Data in the DB and in Attendance** = only after the HRM receives a successful POST and writes to its DB.

---

## If it’s still not showing

1. **Confirm the POST is sent**  
   In the app, add a log right before the sync request (e.g. in `HRMSyncService`): log the URL and “sending sync”. When you clock out, you should see that log. If you don’t, the env vars are wrong or the sync code path isn’t run.

2. **Confirm the POST reaches the HRM**  
   On the machine running the HRM (`npm run dev`), watch the terminal when you clock out. You should see a request like `POST /api/mobile/sync/time-entry`. If that never appears, the request isn’t reaching the HRM (wrong URL, or on a physical device you must use the Mac’s IP instead of `localhost`).

3. **Confirm the response**  
   In the app, log the HTTP status and response body after the sync call. 200 = success (data should be in the DB and in Attendance). 401 = wrong secret, 404 = RBT not found, 400 = bad payload.

Use the full steps in **docs/MOBILE_TEAM_FIX_SYNC_PROMPT.md** to fix the API-based sync.

---

## Alternative: mobile app writes directly to the HRM database (Supabase)

If you prefer the mobile app to **insert directly** into the HRM’s Supabase (instead of calling the HRM API), the HRM’s **Attendance & Hours** page will still show the data, because it reads from the same `time_entries` and `session_notes` tables.

Below is what the mobile team needs to know to do that. The HRM does not provide or support this flow out of the box; the API approach is preferred (one secret, validation, no DB credentials in the app).

### What the HRM database is

- The HRM app uses **one** PostgreSQL database (your Supabase project, from the HRM’s `DATABASE_URL`).
- Tables that matter for Attendance:
  - **`time_entries`** – one row per clock-in/clock-out pair.
  - **`session_notes`** – optional, one row per time entry for session notes.

### Tables and required columns

**`time_entries`**

| Column | Type | Required | Notes |
|--------|------|----------|--------|
| `id` | TEXT | Yes | Unique id (e.g. generate a cuid or UUID). |
| `rbtProfileId` | TEXT | Yes | Must match an existing row in `rbt_profiles.id` (cuid). |
| `clockInTime` | TIMESTAMPTZ | Yes | When the RBT clocked in. |
| `clockOutTime` | TIMESTAMPTZ | Yes | When the RBT clocked out. |
| `totalHours` | DOUBLE PRECISION | No | Can compute: (clockOutTime - clockInTime) in hours. |
| `source` | TEXT | No | Use `'MOBILE_APP'` so it’s clear it came from the app. |
| `signatureStatus` | TEXT | No | One of: `SIGNED`, `MISSING`, `NA`. |
| `guardianName` | TEXT | No | If signature obtained. |
| `signedAt` | TIMESTAMPTZ | No | When signed. |
| `guardianUnavailableReason` | TEXT | No | If guardian unavailable. |
| `guardianUnavailableNote` | TEXT | No | If guardian unavailable. |
| `notes` | TEXT | No | Free-text notes. |
| `mobileClockEventIdClockIn` | TEXT | No | Id from app for idempotency. |
| `mobileClockEventIdClockOut` | TEXT | No | Id from app for idempotency. |
| `createdAt` | TIMESTAMPTZ | No | Default: now(). |
| `updatedAt` | TIMESTAMPTZ | Yes | Set to now(). |

**`session_notes`** (optional, after inserting a time entry)

| Column | Type | Required | Notes |
|--------|------|----------|--------|
| `id` | TEXT | Yes | Unique id (e.g. cuid or UUID). |
| `timeEntryId` | TEXT | Yes | The `id` of the row you just inserted in `time_entries`. |
| `rbtProfileId` | TEXT | Yes | Same as the time entry’s `rbtProfileId`. |
| `summary` | TEXT | No | Session summary. |
| `whereServicesWere` | TEXT | No | |
| `whosInvolved` | TEXT | No | |
| `goalsWorkedOn` | TEXT | No | |
| `behaviorsObserved` | TEXT | No | |
| `reinforcersUsed` | TEXT | No | |
| `generalComments` | TEXT | No | |
| `submittedAt` | TIMESTAMPTZ | No | When notes were submitted. |
| `createdAt` | TIMESTAMPTZ | No | Default: now(). |
| `updatedAt` | TIMESTAMPTZ | Yes | Set to now(). |

### How the mobile app would write to this database

1. **Get credentials from the HRM team**  
   - Supabase project URL (same as in the HRM’s `DATABASE_URL`, e.g. `https://xxxx.supabase.co` for API, or the Postgres host for direct SQL).  
   - A key that can insert into `time_entries` and `session_notes`. Options:  
     - **Supabase client in the app:** use the HRM project’s Supabase URL and a key with insert rights (e.g. service role, or a custom role with limited insert).  
     - **Edge Function / backend:** app calls your backend, backend uses the HRM DB URL and a secure key to insert (keeps DB credentials out of the app).

2. **Generate `id`s**  
   Use a cuid or UUID for `time_entries.id` and `session_notes.id`.

3. **Insert order**  
   Insert one row into `time_entries` (with all required and any optional columns). If you have session notes, insert one row into `session_notes` with `timeEntryId` = the new time entry’s `id`.

4. **`rbtProfileId`**  
   Must be an existing `rbt_profiles.id` in the **same** HRM database. Get it from the HRM UI (Admin → RBTs & Candidates → open RBT → id in URL).

Once rows are in `time_entries` (and optionally `session_notes`), the HRM’s **Attendance & Hours** page will show them, because it reads from those tables.

---

## Summary

- **With the keys set:** Clock out (and notes) are supposed to be sent to the HRM via **one POST**. The HRM then writes to **its** database. Attendance reads from that same database, so **if the POST succeeds, it will show**.
- **If it still doesn’t show:** The POST isn’t succeeding. Use **docs/MOBILE_TEAM_FIX_SYNC_PROMPT.md** to add logging and fix URL/secret/RBT id.
- **If you want the app to write directly to the HRM Supabase:** Use the table/column info above; the HRM Attendance will show any data that ends up in `time_entries` and `session_notes` in the HRM database.
