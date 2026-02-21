# Mobile app team: fix HRM sync (clock out → show in Attendance)

**Problem:** User clocks in and clocks out in the app, but nothing appears on the HRM localhost **Attendance & Hours** page. The sync is not working.

**Goal:** When we clock out in the app, a POST must reach the HRM and the time entry must appear in HRM → Admin → Attendance & Hours.

---

## 1. Confirm these three env vars are set and correct

The app only sends the sync request if **all three** are set. If any is missing, no request is sent.

| Variable | Where to set (Xcode) | Example value | Notes |
|----------|----------------------|---------------|--------|
| `HRM_BASE_URL` | Edit Scheme → Run → Arguments → Environment Variables | `http://localhost:3000` or `http://192.168.1.5:3000` | **Physical device:** use the Mac’s IP (e.g. `http://192.168.1.xxx:3000`), not `localhost`. **Simulator:** `http://localhost:3000` is OK. |
| `MOBILE_SYNC_SECRET` | Same | `riseandshine-mobile-sync-secret-2025` | Must match exactly what HRM has in `.env` as `MOBILE_SYNC_SECRET`. No extra spaces or quotes. |
| `HRM_RBT_PROFILE_ID` | Same | e.g. `clxy1234abcd...` | The **cuid** of a real RBT in the HRM. Get it: open HRM in browser → Admin → RBTs & Candidates → open one RBT → copy the id from the URL (e.g. `/admin/rbts/clxy1234...`). Use a HIRED RBT. |

**Check:** In the scheme you’re actually using to run the app, open Arguments → Environment Variables and confirm all three exist and have the correct values.

---

## 2. Add logging in the app so we can see what’s happening

In **HRMSyncService** (or wherever the sync is triggered after clock out):

1. **Before sending:** Log that sync is being attempted and the URL (e.g. `print("HRM sync: posting to \(url)")`). If this never prints when you clock out, the env vars are missing or the sync call isn’t being reached.
2. **After the request:** Log the HTTP status code and, if not 200, the response body (e.g. `print("HRM sync: status \(statusCode), body \(body)")`).
   - **401** = wrong or missing `MOBILE_SYNC_SECRET`.
   - **404** = `HRM_RBT_PROFILE_ID` not found in HRM (wrong id or wrong HRM instance).
   - **400** = invalid payload (e.g. missing required fields or bad date format).
   - **No request / connection error** = wrong URL or device can’t reach the host (e.g. using `localhost` on a physical device).

---

## 3. Verify the request reaches the HRM

- On the **Mac running the HRM** (`npm run dev`), watch the terminal when you clock out in the app.
- You should see a line like: `POST /api/mobile/sync/time-entry` (or similar, depending on Next.js logging).
- If that **never** appears when you clock out, the request is either not being sent (check env vars and logs from step 2) or not reaching the Mac (wrong URL / firewall / device not on same network).

---

## 4. Test the HRM API from the Mac (sanity check)

On the Mac where the HRM is running, in Terminal:

```bash
curl -X POST "http://localhost:3000/api/mobile/sync/time-entry" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer riseandshine-mobile-sync-secret-2025" \
  -d '{"hrmRbtProfileId":"PASTE_REAL_RBT_CUID_HERE","clockInEventId":"test-in-1","clockOutEventId":"test-out-1","clockInTime":"2025-02-19T12:00:00.000Z","clockOutTime":"2025-02-19T14:00:00.000Z"}'
```

Replace `PASTE_REAL_RBT_CUID_HERE` with a real RBT cuid from the HRM (Admin → RBTs → open one → copy id from URL). If this returns **200** and a time entry appears in HRM → Attendance & Hours, the HRM side is working and the issue is only on the app side (env vars, URL, or payload).

---

## 5. Payload the app must send

The app must POST to `{HRM_BASE_URL}/api/mobile/sync/time-entry` with:

- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <MOBILE_SYNC_SECRET>`
- **Body (JSON):** At minimum:
  - `hrmRbtProfileId` (string) = value of `HRM_RBT_PROFILE_ID`
  - `clockInEventId` (string) = e.g. UUID from clock-in
  - `clockOutEventId` (string) = e.g. UUID from clock-out
  - `clockInTime` (string) = ISO 8601, e.g. `"2025-02-19T12:00:00.000Z"`
  - `clockOutTime` (string) = ISO 8601, must be after `clockInTime`

Optional: `signatureStatus`, `guardianName`, `signedAt`, `guardianUnavailableReason`, `guardianUnavailableNote`, `notes`, `sessionNote` (object with summary, etc.). Full spec: see **docs/MOBILE_APP_HRM_SYNC_SPEC.md** in the HRM repo.

---

## 6. Checklist (do in order)

- [ ] All three env vars set in the **correct Xcode scheme** (the one used when you run the app).
- [ ] On a **physical device**, `HRM_BASE_URL` is the Mac’s IP (e.g. `http://192.168.1.x:3000`), not `localhost`.
- [ ] `HRM_RBT_PROFILE_ID` is a real RBT cuid from the **same** HRM instance (localhost) you’re testing against.
- [ ] Logging added: sync attempt + URL, then status code + body after request.
- [ ] Clock out once and check: (1) app logs show sync attempted and what status/body came back, (2) HRM terminal shows `POST /api/mobile/sync/time-entry` if request reached the server.
- [ ] If still nothing: run the `curl` from step 4 on the Mac; if that works, fix app URL/secret/payload to match.

Once the request reaches the HRM with a valid secret and RBT id, the time entry will appear under **Attendance & Hours** on localhost.
