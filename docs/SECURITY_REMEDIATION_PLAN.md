# SECURITY REMEDIATION PLAN (Stage 1 Triage)

This document classifies every endpoint currently flagged in `docs/SECURITY_AUDIT.md` as **GUARDED (false positive)**, **INTENTIONALLY PUBLIC**, or **REAL GAP**.

## Baseline Evidence
- `middleware.ts:30-33` explicitly lets all `/api/*` requests pass through; API routes must self-guard.
- Public carve-outs: `middleware.ts:12-14` (`/api/public/*`), `middleware.ts:22-24` (`/.well-known/*`).

## Triage Summary
- Total flagged endpoint-method rows triaged: **153**
- GUARDED (false positive): **18**
- INTENTIONALLY PUBLIC: **21**
- REAL GAP: **114**
- REAL GAP touching PHI: **59**

## Stage 2 Step 0 — Guard Buckets (REAL GAP only)

Automated bucketing of the **114 REAL GAP** endpoint-methods (see `scripts/bucket-real-gaps.mjs`). Several Bucket A items already had `requireClientServicesSession` + `enforceClientScope` (view); triage did not detect that helper — writes still needed `assertCanEditClient`.

| Bucket | Guard required | Endpoint-methods | PHI-touching | Batch |
|--------|----------------|------------------:|-------------:|-------|
| **A — Client Services / PHI** | Elevated CS session + per-client `assertCanViewClient` (read) / `assertCanEditClient` (write) | **11** | **11** | 1 |
| **B — Admin / HR / payroll / billing** | `requireAdminSession` / `requireBillingManagerSession` / super-admin | **52** | **18** | 2 |
| **C — RBT self-service** | Valid RBT session + resource resolves to signed-in RBT | **40** | **24** | 3 |
| **D — Other authenticated** | Valid session + appropriate role (activity, mapbox, mcp, onboarding, auth/me) | **11** | **6** | 4 |
| **E — Intentionally public** | Token/nonce + rate limit (confirm only — **not** in REAL GAP count) | **21** | **12** | 5 |

**Also in Batch 1 (server actions, not in API row count):** `lib/schedule/actions.ts` — `createSlot`, `updateSlot`, `deleteSlot`, `duplicateSlot`, `bulkUpdateSlots`, `bulkDeleteSlots`, `updateClientMeta`, `addAllowedUser`, `removeAllowedUser`.

### Bucket A endpoints (11)
- `client-services/clients/[id]/breaks` GET/PATCH/POST
- `client-services/clients/[id]/documents` PATCH, `…/upload` POST
- `client-services/clients/[id]/notes` POST
- `client-services/clients/[id]/schedule` GET
- `client-services/clients` GET (list uses `getVisibleClientsWhere`; no IDOR)
- `clinical/logs` GET
- `supervision/events` GET/POST

### System / cron / token callers — do NOT add user session guards

| Route pattern | Auth mechanism | Notes |
|---------------|----------------|-------|
| `/api/cron/*` | `assertCronOrResponse` / `assertCrmCronOrResponse` | Already GUARDED in triage |
| `/api/public/*` | Scheduling token, apply draft token, company-docs token | Bucket E — confirm scope |
| `/api/oauth/*` | OAuth client credentials + PKCE | Bucket E |
| `/api/auth/send-otp`, `verify-otp`, `logout`, `get-latest-otp` | OTP store + rate limits | Bucket E |
| `/api/health` | None (liveness) | Bucket E |
| `/api/mcp` | MCP API key (Batch 4) | System actor — not cookie session |

### Middleware defense-in-depth (future)
Consider default-deny on `/api/*` in `middleware.ts` with an explicit public allowlist (`/api/public/*`, `/api/oauth/*`, OTP routes, `/api/health`). Handler-level guards remain required regardless (Prisma bypasses RLS).

## Stage 2 Batch 1 — Client Services / PHI (completed)

**Shared helpers added:**
- `lib/client-services/access.ts` — `enforceClientScopeForEdit` (write path → `assertCanEditClient`)
- `lib/schedule/clientScope.ts` — `assertScheduleClientEdit`, `assertScheduleAssignmentIdsEdit`

**Route / action changes:**
- CS write routes: breaks, notes, documents, document upload, schedule-links mutations → edit scope
- `lib/schedule/actions.ts`: per-client edit checks on all slot CRUD/bulk; ACL mutations full-access only
- `clinical/logs`, `supervision/events`: employee ownership on POST; per-client view when `clientId` set
- `client-services/auth/elevate`: confirmed — access code + OTP rate limits already present

**False-positive note:** Bucket A GET routes with `enforceClientScope` were already view-scoped; triage flagged missing `assertCanViewClient` by name only.

## Stage 2 Batch 2 — Admin / HR / payroll / billing (completed)

### Guard split before edits (Bucket B)
- **Initial path-only scan (from triage rows):** 38 route files, 34 already guarded, 4 appeared unguarded.
- **After manual verification:** 37 already guarded, **1 true no-guard gap**.
- Reclassified from the apparent no-guard pile:
  - `app/api/hr-tasks/[id]/bt-upload/route.ts`, `app/api/hr-tasks/[id]/hr-file/route.ts` are owner-scoped RBT routes (Bucket C, not Bucket B admin guards).
  - `app/api/operations/reconcile/route.ts` is already guarded by `requireOperationsSession` (custom system-role guard).

### Real security fixes (no guard at all)
- `app/api/debug/db-counts/route.ts` now enforces `requireAdminSession` (401/403 at handler).

### Standardization-only refactors (already guarded)
- Standardized to shared helper + preserved super-admin policy:
  - `app/api/admin/activity-logs/route.ts`
  - `app/api/admin/users/route.ts`
  - `app/api/admin/users/[id]/route.ts`
- Standardized `app/api/exports/payroll/route.ts` from ad-hoc `validateSession + isAdmin` to `requireAdminSession`.
- Billing APIs intentionally retain `requireBillingManagerSession` (no standardization to `requireAdminSession`) so billing-manager access is not narrowed.

### Batch 2 verification
- `npx tsc --noEmit` ✅
- `npx vitest run lib/crm/access.test.ts lib/crm/claims.test.ts lib/client-services/access.test.ts lib/schedule/clientScope.test.ts` ✅ (28/28)
- Billing guard sanity check: all billing handlers still reference `requireBillingManagerSession` (16 route files).

## CRITICAL Candidates (REAL GAP + PHI)

These are unauth/insufficiently guarded PHI-sensitive handlers pending confirmation/fix:

- `app/api/activity/track/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/activity-logs/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/documents/company/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/documents/company/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/payroll/runs/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/payroll/upload/route.ts` [POST] — Add auth guard and return generic errors only.
- `app/api/admin/payroll/ytd/import/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/payroll/ytd/parse/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/team/availability/override/route.ts` [GET] — Replace unsafe raw SQL with parameterized Prisma/$queryRaw and validate inputs.
- `app/api/admin/team/availability/override/route.ts` [POST] — Replace unsafe raw SQL with parameterized Prisma/$queryRaw and validate inputs.
- `app/api/admin/users/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/users/route.ts` [POST] — Add auth guard and return generic errors only.
- `app/api/billing/cycles/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/cycles/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/mappings/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/mappings/route.ts` [PATCH] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/rates/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/client-services/clients/[id]/breaks/route.ts` [GET] — Add assertCanViewClient/assertCanEditClient for each client/object-id operation.
- `app/api/client-services/clients/[id]/breaks/route.ts` [PATCH] — Add assertCanViewClient/assertCanEditClient for each client/object-id operation.
- `app/api/client-services/clients/[id]/breaks/route.ts` [POST] — Add assertCanViewClient/assertCanEditClient for each client/object-id operation.
- `app/api/client-services/clients/[id]/documents/[documentId]/upload/route.ts` [POST] — Add assertCanViewClient/assertCanEditClient for each client/object-id operation.
- `app/api/client-services/clients/[id]/documents/route.ts` [PATCH] — Add assertCanViewClient/assertCanEditClient for each client/object-id operation.
- `app/api/client-services/clients/[id]/notes/route.ts` [POST] — Add assertCanViewClient/assertCanEditClient for each client/object-id operation.
- `app/api/client-services/clients/[id]/schedule/route.ts` [GET] — Add assertCanViewClient/assertCanEditClient for each client/object-id operation.
- `app/api/client-services/clients/route.ts` [GET] — Add assertCanViewClient/assertCanEditClient for each client/object-id operation.
- `app/api/clinical/logs/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/exports/payroll/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/mapbox/autocomplete/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/mapbox/details/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/mobile/sync/time-entry/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/onboarding/acknowledge/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/onboarding/notice-receipt/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/onboarding/pdf/upload/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/operations/reconcile/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/profile/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/profile/route.ts` [PATCH] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/profile/sessions/route.ts` [DELETE] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/availability/route.ts` [GET] — Add auth guard and return generic errors only.
- `app/api/rbt/availability/route.ts` [POST] — Add auth guard and return generic errors only.
- `app/api/rbt/client-info/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/documents/company/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/documents/route.ts` [GET] — Add auth guard and return generic errors only.
- `app/api/rbt/esign-consent/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/leave-requests/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/messages/read/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/messages/route.ts` [GET] — Add auth guard and return generic errors only.
- `app/api/rbt/messages/route.ts` [POST] — Add auth guard and return generic errors only.
- `app/api/rbt/onboarding-package/download/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/onboarding-tasks/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/onboarding/progress/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/onboarding/quiz/status/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/onboarding/quiz/submit/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/pay/statements/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/pay/stubs/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/pay/summary/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/resources/upload/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/schedule/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/supervision/events/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/supervision/events/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.

## Endpoint Classification Table

| Endpoint | Method | Touches PHI | Classification | Evidence | Action |
|---|---|---|---|---|---|
| `app/api/activity/track/route.ts` | POST | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/activity-logs/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/documents/company/[id]/recipients/[recipientId]/submission/route.ts` | GET | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/documents/company/[id]/resend/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/documents/company/[id]/route.ts` | GET | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/documents/company/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/documents/company/route.ts` | POST | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/employees/[employeeId]/alerts/route.ts` | GET | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/employees/[employeeId]/alerts/route.ts` | PATCH | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/messages/route.ts` | GET | yes | GUARDED (false positive) | `app/api/admin/messages/route.ts:14` (const auth = await requireAdminSession()) | Keep auth; harden error payloads to generic messages only. |
| `app/api/admin/onboarding/repair-tasks/route.ts` | POST | yes | GUARDED (false positive) | `app/api/admin/onboarding/repair-tasks/route.ts:76` (const auth = await requireAdminSession()) | Keep auth; harden error payloads to generic messages only. |
| `app/api/admin/payroll/runs/[id]/confirm-match/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/payroll/runs/[id]/publish/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/payroll/runs/[id]/reopen/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/payroll/runs/[id]/route.ts` | DELETE | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/payroll/runs/[id]/route.ts` | GET | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/payroll/runs/[id]/route.ts` | PATCH | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/payroll/runs/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/payroll/upload/route.ts` | POST | yes | REAL GAP | none found in handler | Add auth guard and return generic errors only. |
| `app/api/admin/payroll/ytd/import/route.ts` | POST | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/payroll/ytd/parse/route.ts` | POST | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/rbts/send-id-reminder/route.ts` | POST | yes | GUARDED (false positive) | `app/api/admin/rbts/send-id-reminder/route.ts:12` (const auth = await requireAdminSession()) | Keep auth; harden error payloads to generic messages only. |
| `app/api/admin/team/availability/override/route.ts` | GET | yes | REAL GAP | `app/api/admin/team/availability/override/route.ts:20` (const auth = await requireAdminSession()) | Replace unsafe raw SQL with parameterized Prisma/$queryRaw and validate inputs. |
| `app/api/admin/team/availability/override/route.ts` | POST | yes | REAL GAP | `app/api/admin/team/availability/override/route.ts:20` (const auth = await requireAdminSession()) | Replace unsafe raw SQL with parameterized Prisma/$queryRaw and validate inputs. |
| `app/api/admin/users/[id]/route.ts` | DELETE | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/users/[id]/route.ts` | GET | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/users/[id]/route.ts` | PATCH | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/users/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/admin/users/route.ts` | POST | yes | REAL GAP | none found in handler | Add auth guard and return generic errors only. |
| `app/api/auth/get-latest-otp/route.ts` | POST | no | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/auth/logout/route.ts` | POST | yes | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/auth/me/route.ts` | GET | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/auth/send-otp/route.ts` | POST | yes | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/auth/verify-otp/route.ts` | POST | yes | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/billing/cycles/[id]/bulk-actions/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/cycles/[id]/confirm-match/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/cycles/[id]/export/route.ts` | GET | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/cycles/[id]/finalize/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/cycles/[id]/hours-confirmation/route.ts` | GET | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/cycles/[id]/hours-confirmation/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/cycles/[id]/payable-statuses/route.ts` | PATCH | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/cycles/[id]/reopen/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/cycles/[id]/route.ts` | DELETE | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/cycles/[id]/route.ts` | GET | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/cycles/[id]/tax-disclaimer/route.ts` | GET | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/cycles/[id]/tax-disclaimer/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/cycles/[id]/upload/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/cycles/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/cycles/route.ts` | POST | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/entries/[id]/hours-confirmation/route.ts` | GET | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/entries/[id]/hours-confirmation/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/entries/[id]/route.ts` | PATCH | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/mappings/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/mappings/route.ts` | PATCH | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/rates/[rbtId]/route.ts` | PATCH | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/billing/rates/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/client-services/auth/elevate/route.ts` | POST | yes | GUARDED (false positive) | `app/api/client-services/auth/elevate/route.ts:47` (const auth = await requireClientServicesEligibleSession()) | No auth fix required; keep handler-level guard. |
| `app/api/client-services/clients/[id]/breaks/route.ts` | GET | yes | REAL GAP | `app/api/client-services/clients/[id]/breaks/route.ts:31` (const auth = await requireClientServicesSession()) | Add assertCanViewClient/assertCanEditClient for each client/object-id operation. |
| `app/api/client-services/clients/[id]/breaks/route.ts` | PATCH | yes | REAL GAP | `app/api/client-services/clients/[id]/breaks/route.ts:31` (const auth = await requireClientServicesSession()) | Add assertCanViewClient/assertCanEditClient for each client/object-id operation. |
| `app/api/client-services/clients/[id]/breaks/route.ts` | POST | yes | REAL GAP | `app/api/client-services/clients/[id]/breaks/route.ts:31` (const auth = await requireClientServicesSession()) | Add assertCanViewClient/assertCanEditClient for each client/object-id operation. |
| `app/api/client-services/clients/[id]/documents/[documentId]/upload/route.ts` | POST | yes | REAL GAP | `app/api/client-services/clients/[id]/documents/[documentId]/upload/route.ts:17` (const auth = await requireClientServicesSession()) | Add assertCanViewClient/assertCanEditClient for each client/object-id operation. |
| `app/api/client-services/clients/[id]/documents/route.ts` | PATCH | yes | REAL GAP | `app/api/client-services/clients/[id]/documents/route.ts:15` (const auth = await requireClientServicesSession()) | Add assertCanViewClient/assertCanEditClient for each client/object-id operation. |
| `app/api/client-services/clients/[id]/notes/route.ts` | POST | yes | REAL GAP | `app/api/client-services/clients/[id]/notes/route.ts:15` (const auth = await requireClientServicesSession()) | Add assertCanViewClient/assertCanEditClient for each client/object-id operation. |
| `app/api/client-services/clients/[id]/schedule/route.ts` | GET | yes | REAL GAP | `app/api/client-services/clients/[id]/schedule/route.ts:25` (const auth = await requireClientServicesSession()) | Add assertCanViewClient/assertCanEditClient for each client/object-id operation. |
| `app/api/client-services/clients/route.ts` | GET | yes | REAL GAP | `app/api/client-services/clients/route.ts:21` (const auth = await requireClientServicesSession()) | Add assertCanViewClient/assertCanEditClient for each client/object-id operation. |
| `app/api/client-services/therapist-search/route.ts` | POST | yes | GUARDED (false positive) | `app/api/client-services/therapist-search/route.ts:31` (const auth = await requireClientServicesSession()) | Keep auth; harden error payloads to generic messages only. |
| `app/api/clinical/logs/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/cron/crm-digest/route.ts` | GET | yes | GUARDED (false positive) | `app/api/cron/crm-digest/route.ts:22` (const denied = assertCrmCronOrResponse(request)) | Keep auth; harden error payloads to generic messages only. |
| `app/api/cron/daily-interview-digest/route.ts` | GET | yes | GUARDED (false positive) | `app/api/cron/daily-interview-digest/route.ts:34` (const auth = assertCronOrResponse(request)) | Keep auth; harden error payloads to generic messages only. |
| `app/api/cron/interview-reminders-1hr/route.ts` | GET | yes | GUARDED (false positive) | `app/api/cron/interview-reminders-1hr/route.ts:18` (const auth = assertCronOrResponse(request)) | Keep auth; harden error payloads to generic messages only. |
| `app/api/cron/interview-reminders/route.ts` | GET | yes | GUARDED (false positive) | `app/api/cron/interview-reminders/route.ts:24` (const auth = assertCronOrResponse(request)) | Keep auth; harden error payloads to generic messages only. |
| `app/api/cron/send-interview-reminders/route.ts` | GET | yes | GUARDED (false positive) | `app/api/cron/send-interview-reminders/route.ts:16` (const auth = assertCronOrResponse(request)) | Keep auth; harden error payloads to generic messages only. |
| `app/api/debug/db-counts/route.ts` | GET | no | REAL GAP | none found in handler | Add auth guard and return generic errors only. |
| `app/api/exports/payroll/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/health/route.ts` | GET | no | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/hr-tasks/[id]/bt-upload/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/hr-tasks/[id]/hr-file/route.ts` | GET | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/mapbox/autocomplete/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/mapbox/details/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/mcp/route.ts` | DELETE | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/mcp/route.ts` | GET | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/mcp/route.ts` | OPTIONS | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/mcp/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/mobile/sync/time-entry/route.ts` | POST | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/oauth/authorize/route.ts` | GET | yes | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/oauth/register/route.ts` | OPTIONS | yes | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/oauth/register/route.ts` | POST | yes | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/oauth/token/route.ts` | OPTIONS | yes | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/onboarding/acknowledge/route.ts` | POST | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/onboarding/notice-receipt/route.ts` | POST | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/onboarding/pdf/upload/route.ts` | POST | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/operations/reconcile/route.ts` | POST | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/profile/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/profile/route.ts` | PATCH | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/profile/sessions/[sessionId]/route.ts` | DELETE | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/profile/sessions/route.ts` | DELETE | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/public/apply/draft/route.ts` | POST | no | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/public/apply/submit/route.ts` | POST | yes | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/public/apply/upload/route.ts` | POST | yes | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/public/calendar/ics/route.ts` | GET | yes | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/public/company-docs/[token]/file/route.ts` | GET | yes | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/public/company-docs/[token]/route.ts` | GET | yes | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/public/company-docs/[token]/sign/route.ts` | POST | yes | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/public/company-docs/[token]/view/route.ts` | POST | yes | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/public/interviewer-slots/route.ts` | GET | yes | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/public/interviewers/route.ts` | GET | yes | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/public/schedule-interview/route.ts` | POST | yes | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/public/validate-scheduling-token/route.ts` | GET | yes | INTENTIONALLY PUBLIC | `middleware.ts:12,22,30` allows public/api self-guard model | Keep public; ensure token/rate-limit controls remain enforced. |
| `app/api/rbt/availability/route.ts` | GET | yes | REAL GAP | none found in handler | Add auth guard and return generic errors only. |
| `app/api/rbt/availability/route.ts` | POST | yes | REAL GAP | none found in handler | Add auth guard and return generic errors only. |
| `app/api/rbt/client-info/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/documents/company-dist/[id]/file/route.ts` | GET | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/documents/company/[id]/download/route.ts` | GET | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/documents/company/[id]/sign/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/documents/company/[id]/upload/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/documents/company/[id]/view/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/documents/company/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/documents/my/[documentId]/download/route.ts` | GET | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/documents/route.ts` | GET | yes | REAL GAP | none found in handler | Add auth guard and return generic errors only. |
| `app/api/rbt/esign-consent/route.ts` | POST | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/leave-requests/route.ts` | POST | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/messages/read/route.ts` | POST | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/messages/route.ts` | GET | yes | REAL GAP | none found in handler | Add auth guard and return generic errors only. |
| `app/api/rbt/messages/route.ts` | POST | yes | REAL GAP | none found in handler | Add auth guard and return generic errors only. |
| `app/api/rbt/onboarding-package/download/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/onboarding-tasks/[id]/complete/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/onboarding-tasks/[id]/sign/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/onboarding-tasks/[id]/upload-files/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/onboarding-tasks/[id]/upload/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/onboarding-tasks/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/onboarding/completions/[documentId]/downloaded/route.ts` | PATCH | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/onboarding/documents/[documentId]/pdf/route.ts` | GET | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/onboarding/documents/[documentId]/upload/route.ts` | POST | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/onboarding/progress/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/onboarding/quiz/status/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/onboarding/quiz/submit/route.ts` | POST | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/pay/statements/[id]/route.ts` | GET | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/pay/statements/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/pay/stubs/[id]/route.ts` | GET | no | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/pay/stubs/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/pay/summary/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/resources/upload/route.ts` | POST | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/rbt/schedule/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/schedule/client-boroughs/route.ts` | GET | yes | GUARDED (false positive) | `app/api/schedule/client-boroughs/route.ts:9` (const auth = await requireScheduleSession()) | No auth fix required; keep handler-level guard. |
| `app/api/schedule/client-boroughs/route.ts` | PATCH | yes | GUARDED (false positive) | `app/api/schedule/client-boroughs/route.ts:9` (const auth = await requireScheduleSession()) | No auth fix required; keep handler-level guard. |
| `app/api/schedule/data/route.ts` | GET | yes | GUARDED (false positive) | `app/api/schedule/data/route.ts:8` (const auth = await requireScheduleSession()) | No auth fix required; keep handler-level guard. |
| `app/api/schedule/import/candidates/route.ts` | GET | yes | GUARDED (false positive) | `app/api/schedule/import/candidates/route.ts:9` (const auth = await requireScheduleSession()) | No auth fix required; keep handler-level guard. |
| `app/api/schedule/import/commit/route.ts` | POST | yes | GUARDED (false positive) | `app/api/schedule/import/commit/route.ts:16` (const auth = await requireScheduleSession()) | No auth fix required; keep handler-level guard. |
| `app/api/schedule/import/preview/route.ts` | POST | yes | GUARDED (false positive) | `app/api/schedule/import/preview/route.ts:10` (const auth = await requireScheduleSession()) | No auth fix required; keep handler-level guard. |
| `app/api/schedule/periods/route.ts` | DELETE | yes | GUARDED (false positive) | `app/api/schedule/periods/route.ts:37` (const auth = await requireScheduleSession()) | No auth fix required; keep handler-level guard. |
| `app/api/schedule/periods/route.ts` | GET | yes | GUARDED (false positive) | `app/api/schedule/periods/route.ts:37` (const auth = await requireScheduleSession()) | No auth fix required; keep handler-level guard. |
| `app/api/supervision/events/route.ts` | GET | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |
| `app/api/supervision/events/route.ts` | POST | yes | REAL GAP | none found in handler | Add explicit handler-level auth/role guard; return 401/403. |

## REAL GAP Fix Scope (for Stage 2)

- `app/api/activity/track/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/activity-logs/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/documents/company/[id]/recipients/[recipientId]/submission/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/documents/company/[id]/resend/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/documents/company/[id]/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/documents/company/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/documents/company/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/employees/[employeeId]/alerts/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/employees/[employeeId]/alerts/route.ts` [PATCH] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/payroll/runs/[id]/confirm-match/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/payroll/runs/[id]/publish/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/payroll/runs/[id]/reopen/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/payroll/runs/[id]/route.ts` [DELETE] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/payroll/runs/[id]/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/payroll/runs/[id]/route.ts` [PATCH] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/payroll/runs/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/payroll/upload/route.ts` [POST] — Add auth guard and return generic errors only.
- `app/api/admin/payroll/ytd/import/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/payroll/ytd/parse/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/team/availability/override/route.ts` [GET] — Replace unsafe raw SQL with parameterized Prisma/$queryRaw and validate inputs.
- `app/api/admin/team/availability/override/route.ts` [POST] — Replace unsafe raw SQL with parameterized Prisma/$queryRaw and validate inputs.
- `app/api/admin/users/[id]/route.ts` [DELETE] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/users/[id]/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/users/[id]/route.ts` [PATCH] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/users/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/admin/users/route.ts` [POST] — Add auth guard and return generic errors only.
- `app/api/auth/me/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/cycles/[id]/bulk-actions/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/cycles/[id]/confirm-match/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/cycles/[id]/export/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/cycles/[id]/finalize/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/cycles/[id]/hours-confirmation/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/cycles/[id]/hours-confirmation/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/cycles/[id]/payable-statuses/route.ts` [PATCH] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/cycles/[id]/reopen/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/cycles/[id]/route.ts` [DELETE] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/cycles/[id]/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/cycles/[id]/tax-disclaimer/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/cycles/[id]/tax-disclaimer/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/cycles/[id]/upload/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/cycles/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/cycles/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/entries/[id]/hours-confirmation/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/entries/[id]/hours-confirmation/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/entries/[id]/route.ts` [PATCH] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/mappings/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/mappings/route.ts` [PATCH] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/rates/[rbtId]/route.ts` [PATCH] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/billing/rates/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/client-services/clients/[id]/breaks/route.ts` [GET] — Add assertCanViewClient/assertCanEditClient for each client/object-id operation.
- `app/api/client-services/clients/[id]/breaks/route.ts` [PATCH] — Add assertCanViewClient/assertCanEditClient for each client/object-id operation.
- `app/api/client-services/clients/[id]/breaks/route.ts` [POST] — Add assertCanViewClient/assertCanEditClient for each client/object-id operation.
- `app/api/client-services/clients/[id]/documents/[documentId]/upload/route.ts` [POST] — Add assertCanViewClient/assertCanEditClient for each client/object-id operation.
- `app/api/client-services/clients/[id]/documents/route.ts` [PATCH] — Add assertCanViewClient/assertCanEditClient for each client/object-id operation.
- `app/api/client-services/clients/[id]/notes/route.ts` [POST] — Add assertCanViewClient/assertCanEditClient for each client/object-id operation.
- `app/api/client-services/clients/[id]/schedule/route.ts` [GET] — Add assertCanViewClient/assertCanEditClient for each client/object-id operation.
- `app/api/client-services/clients/route.ts` [GET] — Add assertCanViewClient/assertCanEditClient for each client/object-id operation.
- `app/api/clinical/logs/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/debug/db-counts/route.ts` [GET] — Add auth guard and return generic errors only.
- `app/api/exports/payroll/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/hr-tasks/[id]/bt-upload/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/hr-tasks/[id]/hr-file/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/mapbox/autocomplete/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/mapbox/details/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/mcp/route.ts` [DELETE] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/mcp/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/mcp/route.ts` [OPTIONS] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/mcp/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/mobile/sync/time-entry/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/onboarding/acknowledge/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/onboarding/notice-receipt/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/onboarding/pdf/upload/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/operations/reconcile/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/profile/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/profile/route.ts` [PATCH] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/profile/sessions/[sessionId]/route.ts` [DELETE] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/profile/sessions/route.ts` [DELETE] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/availability/route.ts` [GET] — Add auth guard and return generic errors only.
- `app/api/rbt/availability/route.ts` [POST] — Add auth guard and return generic errors only.
- `app/api/rbt/client-info/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/documents/company-dist/[id]/file/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/documents/company/[id]/download/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/documents/company/[id]/sign/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/documents/company/[id]/upload/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/documents/company/[id]/view/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/documents/company/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/documents/my/[documentId]/download/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/documents/route.ts` [GET] — Add auth guard and return generic errors only.
- `app/api/rbt/esign-consent/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/leave-requests/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/messages/read/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/messages/route.ts` [GET] — Add auth guard and return generic errors only.
- `app/api/rbt/messages/route.ts` [POST] — Add auth guard and return generic errors only.
- `app/api/rbt/onboarding-package/download/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/onboarding-tasks/[id]/complete/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/onboarding-tasks/[id]/sign/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/onboarding-tasks/[id]/upload-files/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/onboarding-tasks/[id]/upload/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/onboarding-tasks/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/onboarding/completions/[documentId]/downloaded/route.ts` [PATCH] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/onboarding/documents/[documentId]/pdf/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/onboarding/documents/[documentId]/upload/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/onboarding/progress/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/onboarding/quiz/status/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/onboarding/quiz/submit/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/pay/statements/[id]/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/pay/statements/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/pay/stubs/[id]/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/pay/stubs/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/pay/summary/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/resources/upload/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/rbt/schedule/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/supervision/events/route.ts` [GET] — Add explicit handler-level auth/role guard; return 401/403.
- `app/api/supervision/events/route.ts` [POST] — Add explicit handler-level auth/role guard; return 401/403.
