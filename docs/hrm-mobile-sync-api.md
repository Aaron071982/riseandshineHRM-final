# Mobile App → HRM Time Entry Sync – Implementation Spec

Give this document to the team (or Cursor) building the **Rise & Shine mobile app** so they can push clock-in/out and session notes into the HRM.

> **Same content as** [MOBILE_APP_HRM_SYNC_SPEC.md](MOBILE_APP_HRM_SYNC_SPEC.md). This file exists so the path `docs/hrm-mobile-sync-api.md` works in this repo.

---

## Instructions for the mobile app team

Do the following so that when an RBT clocks out in the app, the time entry appears in the HRM **Attendance & Hours** page.

### 1. Get these three values from the HRM team

- **HRM base URL** – e.g. `http://localhost:3000` for local dev, or the staging/production URL.
- **Sync secret** – A shared secret (HRM will give you the same value they set as `MOBILE_SYNC_SECRET`).
- **HRM RBT profile ID** – The **cuid** of a real RBT in the HRM (e.g. `clxx1234...`). Get it from HRM: Admin → RBTs & Candidates → open an RBT → copy the id from the URL or profile. Use a **HIRED** RBT for testing.

### 2. Set them as environment variables in the app

The app reads `HRM_BASE_URL`, `MOBILE_SYNC_SECRET`, and `HRM_RBT_PROFILE_ID` from the environment. If **any** of these are missing, the app will **not** send a sync request (clock out still works locally, but nothing appears in HRM).

**In Xcode:**

1. Edit Scheme → Run → **Arguments** tab.
2. Under **Environment Variables**, add:
   - `HRM_BASE_URL` = (e.g. `http://localhost:3000` or the URL HRM gave you)
   - `MOBILE_SYNC_SECRET` = (exactly the value HRM gave you; no extra spaces)
   - `HRM_RBT_PROFILE_ID` = (the RBT cuid from step 1)

**Physical device (important):** If you run the app on a **real device**, `localhost` on the device is the phone, not the computer running the HRM. Use your computer's IP address instead, e.g. `http://192.168.1.xxx:3000`. Find the IP: on the Mac running the HRM, run `ipconfig getifaddr en0` in Terminal, or check System Settings → Network.

**Simulator:** `http://localhost:3000` is usually fine.

### 3. Verify the flow

1. HRM must be running (e.g. `npm run dev` on the HRM repo).
2. In the app: **clock in** → (optionally add session notes) → **clock out**.
3. In the HRM: open **Attendance & Hours** (Admin menu). The new time entry should appear within a few seconds.

### 4. If nothing appears in HRM

- **Check env vars:** Confirm all three are set in the Run scheme and that the scheme is the one you're using (not a different scheme that doesn't have them).
- **Check URL:** On a physical device, use the computer's IP, not `localhost`. No trailing slash required; `http://192.168.1.5:3000` is fine.
- **Check RBT id:** It must be a valid cuid that exists in the HRM database (same HRM instance you're pointing at). Copy it again from the RBT profile in the HRM UI.
- **Check HRM terminal:** When you clock out, the HRM dev server should log a request like `POST /api/mobile/sync/time-entry`. If that never appears, the request isn't reaching the HRM (wrong URL or device can't reach the host).
- **Log the sync result in the app:** In `HRMSyncService`, temporarily log the HTTP status code and response body. 401 = wrong or missing secret. 404 = RBT id not found in HRM. 400 = invalid payload (check required fields and ISO timestamps).

### 5. Session notes

If the app sends session notes with the clock-out payload (in the `sessionNote` object), they will be stored and shown in HRM per time entry. The sync API accepts the same payload with or without `sessionNote`.

---

## Current state & what's left (mobile app)

**Working today**

- **Mobile app (demo):** Runs without Supabase. Mock login (e.g. `aaronsiam21@gmail.com` / `111111`), clock in/out card, signature pad, full clock-out flow.
- **HRM:** Sync API is implemented. `POST /api/mobile/sync/time-entry` accepts the payload below, persists time entries and session notes, and they appear on the "Attendance & Hours" dashboard.
- **Mobile app → HRM sync:** The app **does** call the HRM. After a successful clock out, it builds the sync payload (clock in/out IDs and times, signature status, guardian name or unavailable reason/note) and POSTs to `{HRM_BASE_URL}/api/mobile/sync/time-entry` with `Authorization: Bearer <MOBILE_SYNC_SECRET>`. Sync runs only when `HRM_BASE_URL`, `MOBILE_SYNC_SECRET`, and `HRM_RBT_PROFILE_ID` are set in the app's environment (e.g. Xcode scheme env vars). If any are missing, clock out still works but no request is sent.

**To see clock-in/out in HRM**

1. **HRM:** Set `MOBILE_SYNC_SECRET` in `.env`, run HRM (e.g. `npm run dev`).
2. **Mobile:** Set in the app's run environment: `HRM_BASE_URL`, `MOBILE_SYNC_SECRET`, and `HRM_RBT_PROFILE_ID` (the **cuid** of a real RBT in HRM, e.g. from "RBTs & Candidates").
3. In the app: clock in, then clock out. The new time entry should appear under **Attendance & Hours** in the HRM.

---

## How to get sync working (checklist)

### On the HRM side (you)

1. **Set the sync secret**  
   In the HRM `.env` (and in production env vars), add:
   ```bash
   MOBILE_SYNC_SECRET=your-long-random-secret-here
   ```
   Generate a random string (e.g. `openssl rand -hex 32`) and keep it safe. You'll give this **same value** to the mobile app (only in backend/Edge Function config, never in client code).

2. **Decide the base URL**  
   - Local/dev: `http://localhost:3000` (or your HRM dev URL).  
   - Production: e.g. `https://riseandshinehrm.com`.

3. **Give the mobile team (or set in app env)**  
   - **HRM base URL** (e.g. `http://localhost:3000` or production URL).  
   - **Sync secret** (same value as `MOBILE_SYNC_SECRET` in HRM).  
   - **HRM RBT profile ID** – the **cuid** of the RBT in HRM (from "RBTs & Candidates"). The app sends this as `hrmRbtProfileId` so the time entry is linked to the correct RBT. Use a HIRED RBT's id for testing.

4. **Verify the API**  
   You can test from your machine:
   ```bash
   curl -X POST "http://localhost:3000/api/mobile/sync/time-entry" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_MOBILE_SYNC_SECRET" \
     -d '{"hrmRbtProfileId":"<real-rbt-profile-cuid>","clockInEventId":"test-in-1","clockOutEventId":"test-out-1","clockInTime":"2025-02-18T14:00:00.000Z","clockOutTime":"2025-02-18T16:00:00.000Z"}'
   ```
   Use a real `hrmRbtProfileId` from your HRM (e.g. an RBT in "RBTs & Candidates"). Then check **Admin → Attendance & Hours** for the new time entry.

### On the mobile app side

The app already implements sync (see `HRMSyncService`, `HRMTimeEntrySyncPayload`). You only need to configure it:

1. **Set environment variables** (e.g. Xcode scheme → Run → Arguments → Environment Variables):
   - `HRM_BASE_URL` = HRM base URL (e.g. `http://localhost:3000`; no trailing slash required).
   - `MOBILE_SYNC_SECRET` = same value as `MOBILE_SYNC_SECRET` in the HRM `.env`.
   - `HRM_RBT_PROFILE_ID` = the **cuid** of a real RBT in HRM (from "RBTs & Candidates"). This is sent as `hrmRbtProfileId` in the payload.

2. **Flow:** On clock in the app stores a `clockInEventId` (UUID). On clock out it builds the payload (clock in/out IDs and times, signature status, guardian name or unavailable reason/note) and calls the sync service. If any of the three env vars above are missing, sync is skipped (no crash, no request).

3. **Optional: session notes**  
   When the RBT submits session notes for that session, either include `sessionNote` in the same sync request or send a second request with the **same** `clockInEventId` / `clockOutEventId` and the `sessionNote` object so the HRM can attach/update it.

4. **Errors**  
   - 401: wrong or missing secret → check secret and header.  
   - 404: `hrmRbtProfileId` not in HRM → ensure the user's HRM profile id is correct and exists.  
   - 400: invalid body → check required fields and ISO timestamps.  
   Retry on 5xx or network failure (same body is idempotent).

### End-to-end test

1. HRM: set `MOBILE_SYNC_SECRET`, start HRM (e.g. `npm run dev`).  
2. Mobile: use an RBT whose `hrm_rbt_profile_id` exists in HRM (and is HIRED if you enforce that).  
3. In the app: clock in, then clock out (with or without signature).  
4. Confirm the sync request runs (backend logs or network tab if from client).  
5. In HRM: open **Attendance & Hours** and confirm the new time entry and, if sent, session note.

---

## 1. Purpose

When an RBT clocks out in the mobile app (and optionally submits session notes), the app should send that data to the **HRM** so it appears on the HRM "Attendance & Hours" dashboard. The HRM exposes a single **sync API** that the mobile app (or a Supabase Edge Function) calls with the completed time entry and optional session note.

---

## 2. What You Need From HRM

The app reads these from its **environment** (e.g. Xcode scheme env vars). Get the values from the HRM team or from the HRM app (e.g. RBT profile id from "RBTs & Candidates"):

| Item | Description |
|------|-------------|
| **HRM base URL** (`HRM_BASE_URL`) | e.g. `https://riseandshinehrm.com` or `http://localhost:3000` for dev. |
| **Sync secret** (`MOBILE_SYNC_SECRET`) | Same value as `MOBILE_SYNC_SECRET` in the HRM `.env`. Sent as `Authorization: Bearer <secret>` on every request. |
| **HRM RBT profile ID** (`HRM_RBT_PROFILE_ID`) | The **cuid** of the RBT in HRM (from "RBTs & Candidates"). Sent as `hrmRbtProfileId` in the payload so the time entry is linked to the correct RBT. Use a HIRED RBT for testing. |

If any of these are missing, the app does not send a sync request (clock out still succeeds locally).

---

## 3. Endpoint

- **URL:** `{HRM_BASE_URL}/api/mobile/sync/time-entry`
- **Method:** `POST`
- **Content-Type:** `application/json`

---

## 4. Authentication

Send the sync secret on every request using **one** of these:

- **Option A – Bearer:**  
  `Authorization: Bearer <sync_secret>`
- **Option B – Custom header:**  
  `X-HRM-Sync-Key: <sync_secret>`

If the secret is missing or wrong, the HRM returns **401 Unauthorized**.

---

## 5. When to Call

- **Required:** After the RBT **clocks out** and the clock_out event is saved in the mobile Supabase `clock_events` table. Send one request per **completed pair** (one clock_in + one clock_out).
- **Optional:** When the RBT **submits session notes** for that session, you can send a **second** request with the **same** `clockInEventId` and `clockOutEventId` and include the `sessionNote` object. The HRM will **update** the existing time entry's session note (idempotent).

So: **at least once** after clock out; optionally again when session notes are submitted, with the same clock event IDs and the new `sessionNote` payload.

---

## 6. Request Body (JSON)

All timestamps must be **ISO 8601** strings (e.g. `"2025-02-18T14:30:00.000Z"`).

### Required fields

| Field | Type | Description |
|-------|------|-------------|
| `hrmRbtProfileId` | string | HRM RBT profile ID (cuid). Same value as in `user_profiles.hrm_rbt_profile_id` in the mobile Supabase. Links this time entry to the RBT in HRM "RBTs & Candidates". |
| `clockInEventId` | string | UUID (or string id) of the **clock_in** row in mobile `clock_events`. Used for idempotency. |
| `clockOutEventId` | string | UUID (or string id) of the **clock_out** row in mobile `clock_events`. Used for idempotency. |
| `clockInTime` | string (ISO date-time) | When the RBT clocked in. |
| `clockOutTime` | string (ISO date-time) | When the RBT clocked out. Must be **after** `clockInTime`. |

### Optional fields (time entry)

| Field | Type | Description |
|-------|------|-------------|
| `hrmShiftId` | string | HRM shift/schedule id if the session is tied to a shift. |
| `signatureStatus` | string | One of: `"signed"`, `"missing"`, `"na"`. |
| `signatureImageUrl` | string | URL or path to the signature image (if signed). |
| `guardianName` | string | Name of the person who signed. |
| `signedAt` | string (ISO date-time) | When the signature was captured. |
| `guardianUnavailableReason` | string | Reason when guardian was not available (e.g. "Guardian not present at session"). |
| `guardianUnavailableNote` | string | Required note when guardian was unavailable. |
| `notes` | string | Free-text notes on the clock event. |
| `latitude` | number | Latitude at clock out (optional). |
| `longitude` | number | Longitude at clock out (optional). |

### Optional: session notes

If you include `sessionNote`, the HRM will create or update the session note for this time entry.

| Field | Type | Description |
|-------|------|-------------|
| `sessionNote.summary` | string | Session summary. |
| `sessionNote.whereServicesWere` | string | Where services were delivered. |
| `sessionNote.whosInvolved` | string | Who was involved. |
| `sessionNote.goalsWorkedOn` | string | Goals worked on. |
| `sessionNote.behaviorsObserved` | string | Behaviors observed. |
| `sessionNote.reinforcersUsed` | string | Reinforcers used. |
| `sessionNote.generalComments` | string | General comments. |
| `sessionNote.payloadJson` | object | Any extra key-value data (flexible). |
| `sessionNote.submittedAt` | string (ISO date-time) | When the session note was submitted. |

---

## 7. Example Request (after clock out, with signature)

```json
{
  "hrmRbtProfileId": "clxx1234567890abcdef",
  "clockInEventId": "550e8400-e29b-41d4-a716-446655440000",
  "clockOutEventId": "550e8400-e29b-41d4-a716-446655440001",
  "clockInTime": "2025-02-18T14:00:00.000Z",
  "clockOutTime": "2025-02-18T16:30:00.000Z",
  "hrmShiftId": "clxx9876543210",
  "signatureStatus": "signed",
  "signatureImageUrl": "signatures/clxx123/2025-02-18/550e8400-e29b-41d4-a716-446655440001.png",
  "guardianName": "Jane Doe",
  "signedAt": "2025-02-18T16:28:00.000Z",
  "notes": null
}
```

**Headers:**

- `Content-Type: application/json`
- `Authorization: Bearer YOUR_SYNC_SECRET`  
  **or**  
- `X-HRM-Sync-Key: YOUR_SYNC_SECRET`

---

## 8. Example Request (clock out + session note in one call)

You can send the session note in the same request as the clock out:

```json
{
  "hrmRbtProfileId": "clxx1234567890abcdef",
  "clockInEventId": "550e8400-e29b-41d4-a716-446655440000",
  "clockOutEventId": "550e8400-e29b-41d4-a716-446655440001",
  "clockInTime": "2025-02-18T14:00:00.000Z",
  "clockOutTime": "2025-02-18T16:30:00.000Z",
  "signatureStatus": "signed",
  "guardianName": "Jane Doe",
  "signedAt": "2025-02-18T16:28:00.000Z",
  "sessionNote": {
    "summary": "Client engaged well with DTT and naturalistic teaching.",
    "whereServicesWere": "Home",
    "whosInvolved": "Client, guardian, RBT",
    "goalsWorkedOn": "Communication, self-help",
    "behaviorsObserved": "None of concern",
    "reinforcersUsed": "Tokens, iPad time",
    "generalComments": "Good session.",
    "submittedAt": "2025-02-18T16:35:00.000Z"
  }
}
```

---

## 9. Response

- **200 OK**  
  Body example:  
  `{ "success": true, "timeEntryId": "clxx..." }`  
  If the same clock-in/out pair was already synced, the HRM may return:  
  `{ "success": true, "timeEntryId": "clxx...", "updated": true }`

- **400 Bad Request**  
  Invalid body or validation failed (e.g. missing required fields, `clockOutTime` not after `clockInTime`). Response body: `{ "error": "..." }`.

- **401 Unauthorized**  
  Missing or invalid sync secret.

- **404 Not Found**  
  `hrmRbtProfileId` does not exist in HRM.

---

## 10. Idempotency and Retries

- The HRM identifies a time entry by the pair `(clockInEventId, clockOutEventId)`.
- If you send the **same** pair again (e.g. retry or "session note later" request), the HRM **updates** the existing time entry (and session note if provided) and returns 200. It does **not** create a duplicate.
- Safe to retry on network failure; use the same request body.

---

## 11. Checklist for Mobile App Implementation

1. **Config:** Add HRM base URL and sync secret (from HRM team). Prefer backend/Edge Function so the secret is not in the client.
2. **After clock out:** When you persist the clock_out event in `clock_events`, call `POST {HRM_BASE_URL}/api/mobile/sync/time-entry` with the payload above. Use the **ids** of the clock_in and clock_out rows for `clockInEventId` and `clockOutEventId`, and `user_profiles.hrm_rbt_profile_id` for `hrmRbtProfileId`.
3. **Optional – session notes:** When the RBT submits session notes for that session, either:
   - Include `sessionNote` in the same request as the clock out, or  
   - Call the sync API again with the **same** `clockInEventId` and `clockOutEventId` and the `sessionNote` object so the HRM can attach/update the note.
4. **Auth:** Send the sync secret on every request via `Authorization: Bearer <secret>` or `X-HRM-Sync-Key: <secret>`.
5. **Errors:** On 4xx/5xx, log and optionally retry (same body). Do not block the user; the mobile DB remains the source of truth; sync can be retried later if you queue or retry in the background.

---

## 12. Quick Reference – Minimal Valid Body

```json
{
  "hrmRbtProfileId": "<cuid from user_profiles.hrm_rbt_profile_id>",
  "clockInEventId": "<uuid of clock_in row in clock_events>",
  "clockOutEventId": "<uuid of clock_out row in clock_events>",
  "clockInTime": "<ISO 8601>",
  "clockOutTime": "<ISO 8601>"
}
```

Everything else is optional. Add signature fields, guardian-unavailable fields, `notes`, `sessionNote`, and geo as needed.
