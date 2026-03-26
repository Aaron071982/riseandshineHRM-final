# HRM full audit report

**Date:** 2026-03-22  
**Scope:** Prisma schema, SQL scripts, API routes (admin/RBT/public/cron), auth, major workflows.  
**Quality gates:** `npm run lint` (clean), `npx tsc --noEmit` (clean), `npm run build` (success).

---

## Safe fixes applied (this pass)

| Area | Change |
|------|--------|
| **Session security** | [`lib/auth.ts`](../lib/auth.ts): `LOCAL_DEV_SESSION_TOKEN` is only accepted when `NODE_ENV !== 'production'` (blocks forged cookie → admin in prod). |
| **Cron security** | New [`lib/cron-auth.ts`](../lib/cron-auth.ts) `assertCronOrResponse`: in **production**, `CRON_SECRET` must be set and caller must match (Bearer or `?secret=`). Non-prod: optional secret for local testing. Wired into all 6 cron routes under `app/api/cron/`. |
| **ESLint** | [`ActionCenterPage.tsx`](../components/admin/ActionCenterPage.tsx): `filterSnoozed` stable deps. [`DashboardAnalytics.tsx`](../components/admin/DashboardAnalytics.tsx): `loadDashboard` wrapped in `useCallback`. [`SchedulingBetaProximityMap.tsx`](../components/admin/SchedulingBetaProximityMap.tsx): memoized `rbtCoordIdsKey` + eslint note for map effect deps. [`OnboardingWizard.tsx`](../components/rbt/OnboardingWizard.tsx): confetti timeout cleanup clears ref. |
| **Docs** | [`.env.example`](../.env.example): notes that `CRON_SECRET` is required in production for crons. |

---

## P0 / P1 findings (no code change this pass unless noted)

### P1 — Database migration hygiene

- **No `prisma/migrations/`** in repo: deployments likely use **`prisma db push`** and/or manual SQL ([`prisma/scripts/*.sql`](../prisma/scripts/), [`prisma/scripts/full-migration.sql`](../prisma/scripts/full-migration.sql)).
- **Risk:** staging/prod drift if SQL isn’t applied in lockstep with [`prisma/schema.prisma`](../prisma/schema.prisma).
- **Recommendation:** Introduce Prisma Migrate for new changes, or maintain a single “source of truth” checklist per release (run `full-migration.sql` or incremental scripts in order). Verify columns such as `Interview.reminder_15m_sent_at`, `reminder_1hr_sent_at`, `claimedByUserId`, `scheduling_clients`, `rbt_messages`, `admin_notifications` exist in production.

### P1 — Naming consistency

- `Interview` mixes **camelCase** (`reminderSentAt`) and **snake_case** (`reminder_15m_sent_at`, `reminder_1hr_sent_at`). Works with Prisma but is easy to mistype in raw SQL or external tools.
- **Recommendation:** Keep camelCase in Prisma for new fields; consider a one-time DB rename with a migration if you standardize.

### P2 — Auth / operational

- **`ADMIN_FALLBACK_EMAIL` + OTP `123456`** in [`app/api/auth/verify-otp/route.ts`](../app/api/auth/verify-otp/route.ts): intentional for ops; ensure **production** list is minimal and reviewed periodically.
- **`isSuperAdmin`** hardcoded emails in [`lib/auth.ts`](../lib/auth.ts): consider env or DB for maintainability.
- **Build-time noise:** `next build` logs `Dynamic server usage` for some routes during static generation (expected for cookie-based handlers); not a runtime failure.

### P2 — RLS / Supabase

- [`prisma/supabase-rls-policies-app.sql`](../prisma/supabase-rls-policies-app.sql) should be reconciled with how the app connects (often server uses service role). Confirm RLS matches your threat model.

---

## Domain trace summary

| Domain | Assessment |
|--------|------------|
| **Auth** | Cookie session + `validateSession` / `requireAdminSession`; raw SQL fallback for resilience. Dev bypasses documented. |
| **Interviews** | Models `Interview`, `InterviewSlot`, `Interviewer*`, cron 15m/1hr/30m + GitHub Actions workflow; [`app/api/admin/interviews/*`](../app/api/admin/interviews/), claim route, public schedule/slots. |
| **Onboarding** | `OnboardingTask`, `OnboardingDocument`, `OnboardingCompletion`; RBT + admin APIs; wizard UI. |
| **Sessions / attendance** | `TimeEntry`, `Shift`, `SessionNote`; RBT clock-in/out, admin attendance/sessions; staleness cron. |
| **Scheduling beta** | `SchedulingClient`, `ClientAssignment`; proximity + assignments APIs. |
| **Action center** | [`app/api/admin/action-center`](../app/api/admin/action-center/route.ts) aggregates counts + sections; `getWorkflowSettings` for staleness thresholds. |
| **Employee CRUD** | Consolidated delete: [`app/api/admin/employees/[employeeId]/[id]/delete`](../app/api/admin/employees/[employeeId]/[id]/delete/route.ts) matches UI paths like `/api/admin/employees/bcba/:id/delete`. |

---

## Regression checklist (manual)

1. **Admin login** — OTP email; confirm fallback only if intended.
2. **Action Center** — loads; snooze still hides items; complete interview from modal.
3. **Interviews** — schedule (public + admin); claim; complete; notes/scorecard.
4. **Crons** — with `CRON_SECRET` set: `GET /api/cron/interview-reminders` with `Authorization: Bearer <secret>` returns 200/JSON (not 401/503). In prod without secret: expect **503**.
5. **RBT onboarding** — tasks list, upload, fillable PDF flow, completion.
6. **Sessions** — clock in/out, current session, history; admin attendance list/edit.
7. **Scheduling beta** — clients, assignments, proximity map (Mapbox token).
8. **Employee delete** — BCBA/Billing/Marketing/Call Center delete from profile pages.

---

## Deferred (larger than “safe fix”)

- Prisma major upgrade (CLI shows 5.x → 7.x available).
- Reducing `console.log` in [`lib/auth.ts`](../lib/auth.ts) `validateSession` for production log noise.
- Resolving Next static generation warnings by marking affected pages/layouts `dynamic = 'force-dynamic'` where appropriate.
