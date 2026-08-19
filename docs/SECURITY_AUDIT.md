# SECURITY AUDIT

Read-only audit of API routes and server actions for access control and data safety before production deploy. No code fixes were applied in this pass.

## Scope
- API routes audited: **309** handler methods under `app/api/**/route.ts`
- Cron routes audited: **10** handler methods under `app/api/cron/**`
- Server actions audited: **69** exported action functions in `'use server'` files

## Risk Summary
- API verdicts: **156 OK** / **153 FLAG**
- Cron auth: **5 OK** / **5 FLAG** (all checked for secret gate)
- Highest concentration of high-risk findings: schedule server actions and a set of client-services ID-based routes missing explicit per-client assertions in-route.

## Prioritized Findings

### CRITICAL
- None confirmed in this pass for unauthenticated PHI dump endpoints or cron-without-secret routes.
- **Caution:** multiple non-public API handlers were flagged as "no clear auth guard" and need targeted code-level confirmation; if any truly lack auth and touch PHI, they become CRITICAL immediately.

### HIGH
- **Unsafe raw SQL primitives in admin availability override routes**
  - `app/api/admin/team/availability/override/route.ts:45` (`$queryRawUnsafe`)
  - `app/api/admin/team/availability/override/route.ts:160` (`$queryRawUnsafe`)
  - Risk: SQL injection surface if input hardening regresses; unsafe raw methods in PHI-adjacent area are unacceptable for long-term posture.
  - Suggested fix: replace with parameterized Prisma query APIs or `$queryRaw` tagged templates and strict schema validation.

- **Client-by-id/object-id routes missing explicit in-route `assertCanViewClient` / `assertCanEditClient`**
  - `app/api/client-services/clients/[id]/breaks/route.ts:30`, :69, :187
  - `app/api/client-services/clients/[id]/documents/[documentId]/upload/route.ts:16`
  - `app/api/client-services/clients/[id]/notes/route.ts:14`
  - Risk: IDOR class risk if helper-level scope checks are incomplete or regress.
  - Suggested fix: add explicit per-client access assertions in each handler before read/write.

- **Schedule server actions allow broad cross-client mutation with schedule-role gate only**
  - `lib/schedule/actions.ts:196` `createSlot`
  - `lib/schedule/actions.ts:228` `updateSlot`
  - `lib/schedule/actions.ts:273` `deleteSlot`
  - `lib/schedule/actions.ts:301` `duplicateSlot`
  - `lib/schedule/actions.ts:335` `bulkUpdateSlots`
  - `lib/schedule/actions.ts:354` `bulkDeleteSlots`
  - `lib/schedule/actions.ts:488` `updateClientMeta`
  - `lib/schedule/actions.ts:550` `addAllowedUser`, `lib/schedule/actions.ts:562` `removeAllowedUser`
  - Risk: user with schedule role may mutate rows beyond claim/client scope.
  - Suggested fix: resolve affected client IDs and enforce `assertCanEditClient`-equivalent per object; restrict ACL mutation to full-access/super-admin.

### MEDIUM
- **Potential internal error-detail leakage in API responses**
  - Examples: `app/api/cron/crm-digest/route.ts`, `app/api/cron/daily-interview-digest/route.ts`, `app/api/cron/interview-reminders*.ts`, `app/api/admin/payroll/upload/route.ts`
  - Risk: exposing stack or operational details in responses aids attackers and leaks internals.
  - Suggested fix: return generic error payloads externally; keep detailed diagnostics in server logs only.

- **Bulk ID mutation endpoints without per-ID ownership assertions**
  - `lib/schedule/actions.ts:335`, `lib/schedule/actions.ts:354`
  - Risk: unauthorized cross-object mutation if ID list includes out-of-scope rows.
  - Suggested fix: pre-validate each target ID against caller scope before mutation.

### LOW
- **Validation consistency gaps**
  - `lib/crm/actions.ts:917` `saveConsentInitials` accepts dynamic key patch with limited runtime schema checks.
  - `lib/crm/actions.ts:2228` `updateScheduleEntry` does not strongly enforce start/end consistency beyond day range.
  - Suggested fix: add zod/object schemas for input and cross-field refinements.

## Endpoint Table — API Routes (all handlers)

| Path | Method | Touches PHI | Auth Required | CS Elevation | Per-object Access Assertion | Role Gate | Verdict |
|---|---|---|---|---|---|---|---|
| `app/api/activity/track/route.ts` | POST | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/admin/action-center/route.ts` | GET | yes | admin/superadmin guard | no | no | yes | OK (no obvious control gap in handler) |
| `app/api/admin/activity-logs/route.ts` | GET | yes | none found | no | n/a | yes | FLAG (no clear auth guard) |
| `app/api/admin/analytics/dashboard/route.ts` | GET | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/analytics/payroll-summary/route.ts` | GET | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/attendance/dashboard/route.ts` | GET | yes | admin/superadmin guard | no | no | yes | OK (no obvious control gap in handler) |
| `app/api/admin/attendance/entries/[id]/clock-out/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/attendance/entries/[id]/route.ts` | DELETE | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/attendance/entries/[id]/route.ts` | PATCH | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/availability/my/route.ts` | GET | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/availability/save/route.ts` | POST | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/availability/upcoming/route.ts` | GET | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/billing/sync-login-users/route.ts` | POST | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/dashboard/rbt-stats/route.ts` | GET | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/documents/company/[id]/recipients/[recipientId]/submission/route.ts` | GET | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/admin/documents/company/[id]/resend/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/admin/documents/company/[id]/route.ts` | GET | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/admin/documents/company/route.ts` | GET | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/admin/documents/company/route.ts` | POST | yes | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/admin/email-blast/[slug]/route.ts` | GET | no | file-level helper usage | no | n/a | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/email-blast/[slug]/route.ts` | POST | no | file-level helper usage | no | n/a | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/employees/[employeeId]/[id]/delete/route.ts` | DELETE | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/employees/[employeeId]/alerts/route.ts` | GET | no | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/admin/employees/[employeeId]/alerts/route.ts` | PATCH | no | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/admin/employees/[employeeId]/credentials/route.ts` | GET | no | file-level helper usage | no | n/a | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/employees/[employeeId]/credentials/route.ts` | PATCH | no | file-level helper usage | no | n/a | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/employees/[employeeId]/credentials/route.ts` | POST | no | file-level helper usage | no | n/a | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/employees/[employeeId]/documents/route.ts` | GET | no | file-level helper usage | no | n/a | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/employees/[employeeId]/documents/route.ts` | PATCH | no | file-level helper usage | no | n/a | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/employees/[employeeId]/documents/route.ts` | POST | no | file-level helper usage | no | n/a | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/employees/bcba/route.ts` | POST | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/employees/billing/route.ts` | POST | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/employees/call-center/route.ts` | POST | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/employees/dev-teams/[teamId]/delete/route.ts` | DELETE | no | file-level helper usage | no | n/a | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/employees/dev-teams/[teamId]/members/[memberId]/delete/route.ts` | DELETE | no | file-level helper usage | no | n/a | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/employees/dev-teams/[teamId]/members/route.ts` | POST | no | file-level helper usage | no | n/a | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/employees/dev-teams/route.ts` | POST | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/employees/hours/route.ts` | GET | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/employees/hours/route.ts` | POST | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/employees/marketing/route.ts` | POST | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/interviews/[id]/claim/route.ts` | DELETE | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/interviews/[id]/claim/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/interviews/[id]/complete/route.ts` | PATCH | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/interviews/[id]/notes/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/interviews/[id]/notes/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/interviews/[id]/route.ts` | DELETE | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/interviews/[id]/scorecard/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/interviews/[id]/scorecard/route.ts` | PUT | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/interviews/[id]/unclaim/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/interviews/route.ts` | POST | yes | admin/superadmin guard | no | no | yes | OK (no obvious control gap in handler) |
| `app/api/admin/leave-requests/[id]/route.ts` | PATCH | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/messages/[rbtProfileId]/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/messages/[rbtProfileId]/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/messages/route.ts` | GET | yes | admin/superadmin guard | no | no | yes | FLAG (possible detailed error leakage) |
| `app/api/admin/notifications/route.ts` | GET | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/notifications/route.ts` | PATCH | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/onboarding-documents/route.ts` | GET | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/onboarding-documents/route.ts` | POST | yes | admin/superadmin guard | no | no | yes | OK (no obvious control gap in handler) |
| `app/api/admin/onboarding/audit-existing-signatures/route.ts` | POST | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/onboarding/completions/[rbtProfileId]/[completionId]/acknowledgment/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/onboarding/completions/[rbtProfileId]/[completionId]/download/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/onboarding/completions/[rbtProfileId]/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/onboarding/repair-tasks/route.ts` | POST | yes | admin/superadmin guard | no | no | yes | FLAG (possible detailed error leakage) |
| `app/api/admin/org-chart/nodes/[id]/route.ts` | DELETE | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/org-chart/nodes/[id]/route.ts` | PATCH | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/org-chart/nodes/route.ts` | POST | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/org-chart/route.ts` | GET | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/org-chart/users/route.ts` | GET | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/payroll/runs/[id]/confirm-match/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/admin/payroll/runs/[id]/publish/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/admin/payroll/runs/[id]/reopen/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/admin/payroll/runs/[id]/route.ts` | DELETE | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/admin/payroll/runs/[id]/route.ts` | GET | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/admin/payroll/runs/[id]/route.ts` | PATCH | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/admin/payroll/runs/route.ts` | GET | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/admin/payroll/upload/route.ts` | POST | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard; possible detailed error leakage) |
| `app/api/admin/payroll/ytd/import/route.ts` | POST | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/admin/payroll/ytd/parse/route.ts` | POST | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/admin/rbts/[id]/active-working/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/audit-logs/[auditId]/route.ts` | DELETE | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/audit-logs/[auditId]/route.ts` | PATCH | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/audit-logs/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/audit-logs/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/availability/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/availability/route.ts` | PATCH | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/completions/[completionId]/certificate/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/delete/route.ts` | DELETE | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/documents/[documentId]/download/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/documents/completion/[completionId]/download/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/documents/request-reupload/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/documents/route.ts` | DELETE | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/documents/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/documents/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/documents/zip/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/download-package/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/email-logs/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/hire/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/hr-documents/[taskId]/hr-file/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/hr-documents/[taskId]/regenerate/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/hr-documents/[taskId]/send/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/hr-documents/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/onboarding-progress/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/onboarding-tasks/[taskId]/download/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/onboarding/background-cleared/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/onboarding/complete-task/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/onboarding/download-all/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/onboarding/oig-log/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/onboarding/oig-log/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/onboarding/set-schedule/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/onboarding/supervision-countersign/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/onboarding/uncomplete-task/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/onboarding/upload-package/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/reject/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/resume/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/route.ts` | PATCH | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/schedule/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/schedule/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/send-email/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/status/route.ts` | PATCH | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/terminate/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/termination/route.ts` | GET | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/termination/route.ts` | POST | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/[id]/termination/tasks/[taskId]/route.ts` | PATCH | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/geocode-all/route.ts` | POST | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/mark-hired-by-name/route.ts` | POST | yes | admin/superadmin guard | no | no | yes | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/route.ts` | GET | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/route.ts` | POST | yes | admin/superadmin guard | no | no | yes | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/send-hired-welcome-today/route.ts` | POST | yes | admin/superadmin guard | no | no | yes | OK (no obvious control gap in handler) |
| `app/api/admin/rbts/send-id-reminder/route.ts` | POST | yes | admin/superadmin guard | no | n/a | yes | FLAG (possible detailed error leakage) |
| `app/api/admin/schedule-assignments/[id]/route.ts` | DELETE | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/schedule-assignments/[id]/route.ts` | PATCH | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/scheduling-beta/assignments/[id]/route.ts` | DELETE | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/scheduling-beta/assignments/[id]/route.ts` | PATCH | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/scheduling-beta/assignments/route.ts` | GET | yes | admin/superadmin guard | no | no | yes | OK (no obvious control gap in handler) |
| `app/api/admin/scheduling-beta/assignments/route.ts` | POST | yes | admin/superadmin guard | no | no | yes | OK (no obvious control gap in handler) |
| `app/api/admin/scheduling-beta/clients/[id]/route.ts` | DELETE | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/scheduling-beta/clients/route.ts` | GET | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/scheduling-beta/clients/route.ts` | POST | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/scheduling-beta/geocode-stats/route.ts` | GET | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/scheduling-beta/proximity/route.ts` | POST | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/scheduling-beta/rbts/route.ts` | GET | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/scheduling/exclusions/[id]/route.ts` | DELETE | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/scheduling/exclusions/route.ts` | GET | yes | admin/superadmin guard | no | no | yes | OK (no obvious control gap in handler) |
| `app/api/admin/scheduling/exclusions/route.ts` | POST | yes | admin/superadmin guard | no | no | yes | OK (no obvious control gap in handler) |
| `app/api/admin/sessions/route.ts` | DELETE | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/settings/workflows/route.ts` | GET | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/settings/workflows/route.ts` | POST | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/team/availability/[userId]/route.ts` | GET | no | file-level helper usage | no | n/a | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/team/availability/override/[id]/route.ts` | DELETE | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/team/availability/override/route.ts` | GET | yes | admin/superadmin guard | no | n/a | yes | FLAG (unsafe raw SQL call) |
| `app/api/admin/team/availability/override/route.ts` | POST | yes | admin/superadmin guard | no | n/a | yes | FLAG (unsafe raw SQL call) |
| `app/api/admin/team/availability/route.ts` | POST | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/team/calendar/route.ts` | GET | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/team/notes/[id]/route.ts` | DELETE | no | file-level helper usage | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/admin/team/notes/route.ts` | DELETE | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/team/notes/route.ts` | POST | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/team/status/route.ts` | GET | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/team/status/route.ts` | POST | yes | admin/superadmin guard | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/admin/users/[id]/route.ts` | DELETE | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/admin/users/[id]/route.ts` | GET | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/admin/users/[id]/route.ts` | PATCH | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/admin/users/route.ts` | GET | yes | none found | no | n/a | yes | FLAG (no clear auth guard) |
| `app/api/admin/users/route.ts` | POST | yes | none found | no | n/a | yes | FLAG (no clear auth guard; possible detailed error leakage) |
| `app/api/auth/get-latest-otp/route.ts` | POST | no | none found | no | n/a | yes | FLAG (no clear auth guard) |
| `app/api/auth/logout/route.ts` | POST | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/auth/me/route.ts` | GET | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/auth/send-otp/route.ts` | POST | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/auth/verify-otp/route.ts` | POST | yes | none found | no | n/a | yes | FLAG (no clear auth guard) |
| `app/api/billing/cycles/[id]/bulk-actions/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/cycles/[id]/confirm-match/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/cycles/[id]/export/route.ts` | GET | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/cycles/[id]/finalize/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/cycles/[id]/hours-confirmation/route.ts` | GET | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/cycles/[id]/hours-confirmation/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/cycles/[id]/payable-statuses/route.ts` | PATCH | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/cycles/[id]/reopen/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/cycles/[id]/route.ts` | DELETE | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/cycles/[id]/route.ts` | GET | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/cycles/[id]/tax-disclaimer/route.ts` | GET | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/cycles/[id]/tax-disclaimer/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/cycles/[id]/upload/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/cycles/route.ts` | GET | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/cycles/route.ts` | POST | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/entries/[id]/hours-confirmation/route.ts` | GET | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/entries/[id]/hours-confirmation/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/entries/[id]/route.ts` | PATCH | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/mappings/route.ts` | GET | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/mappings/route.ts` | PATCH | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/rates/[rbtId]/route.ts` | PATCH | no | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/billing/rates/route.ts` | GET | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/client-services/auth/elevate/route.ts` | POST | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/client-services/clients/[id]/breaks/route.ts` | GET | yes | client-services session | yes | no | no/implicit | FLAG (no explicit client object access assertion) |
| `app/api/client-services/clients/[id]/breaks/route.ts` | PATCH | yes | client-services session | yes | no | no/implicit | FLAG (no explicit client object access assertion) |
| `app/api/client-services/clients/[id]/breaks/route.ts` | POST | yes | client-services session | yes | no | no/implicit | FLAG (no explicit client object access assertion) |
| `app/api/client-services/clients/[id]/care-team/route.ts` | POST | yes | client-services session | yes | yes | yes | OK (no obvious control gap in handler) |
| `app/api/client-services/clients/[id]/documents/[documentId]/upload/route.ts` | POST | yes | client-services session | yes | no | no/implicit | FLAG (no explicit client object access assertion) |
| `app/api/client-services/clients/[id]/documents/route.ts` | PATCH | yes | client-services session | yes | no | no/implicit | FLAG (no explicit client object access assertion) |
| `app/api/client-services/clients/[id]/notes/route.ts` | POST | yes | client-services session | yes | no | no/implicit | FLAG (no explicit client object access assertion) |
| `app/api/client-services/clients/[id]/route.ts` | DELETE | yes | client-services session | yes | yes | yes | OK (no obvious control gap in handler) |
| `app/api/client-services/clients/[id]/route.ts` | GET | yes | client-services session | yes | yes | no/implicit | OK (no obvious control gap in handler) |
| `app/api/client-services/clients/[id]/route.ts` | PATCH | yes | client-services session | yes | yes | yes | OK (no obvious control gap in handler) |
| `app/api/client-services/clients/[id]/schedule/route.ts` | GET | yes | client-services session | yes | no | no/implicit | FLAG (no explicit client object access assertion) |
| `app/api/client-services/clients/export/route.ts` | GET | yes | client-services session | yes | n/a | no/implicit | OK (no obvious control gap in handler) |
| `app/api/client-services/clients/route.ts` | GET | yes | client-services session | yes | no | no/implicit | FLAG (no explicit client object access assertion) |
| `app/api/client-services/clients/route.ts` | POST | yes | client-services session | yes | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/client-services/crm-dashboard/route.ts` | GET | yes | client-services session | yes | n/a | no/implicit | OK (no obvious control gap in handler) |
| `app/api/client-services/dashboard/route.ts` | GET | yes | client-services session | yes | n/a | no/implicit | OK (no obvious control gap in handler) |
| `app/api/client-services/import/route.ts` | POST | yes | client-services session | yes | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/client-services/schedule-links/route.ts` | GET | yes | client-services session | yes | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/client-services/schedule-links/route.ts` | POST | yes | client-services session | yes | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/client-services/settings/route.ts` | GET | yes | client-services session | yes | n/a | no/implicit | OK (no obvious control gap in handler) |
| `app/api/client-services/settings/route.ts` | PATCH | yes | client-services session | yes | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/client-services/therapist-search/route.ts` | POST | yes | client-services session | yes | n/a | yes | FLAG (possible detailed error leakage) |
| `app/api/clinical/logs/route.ts` | GET | yes | none found | no | n/a | yes | FLAG (no clear auth guard) |
| `app/api/clinical/logs/route.ts` | POST | yes | authorization header check | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/cron/compliance-expiration/route.ts` | GET | no | cron secret guard | no | n/a | no/implicit | OK (no obvious control gap in handler) |
| `app/api/cron/crm-alerts/route.ts` | GET | no | cron secret guard | no | n/a | no/implicit | OK (no obvious control gap in handler) |
| `app/api/cron/crm-digest/route.ts` | GET | yes | cron secret guard | no | n/a | no/implicit | FLAG (possible detailed error leakage) |
| `app/api/cron/daily-interview-digest/route.ts` | GET | yes | cron secret guard | no | no | no/implicit | FLAG (possible detailed error leakage) |
| `app/api/cron/interview-reminders-1hr/route.ts` | GET | yes | cron secret guard | no | no | no/implicit | FLAG (possible detailed error leakage) |
| `app/api/cron/interview-reminders/route.ts` | GET | yes | cron secret guard | no | no | no/implicit | FLAG (possible detailed error leakage) |
| `app/api/cron/onboarding-reminders/route.ts` | GET | yes | cron secret guard | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/cron/send-interview-reminders/route.ts` | GET | yes | cron secret guard | no | no | no/implicit | FLAG (possible detailed error leakage) |
| `app/api/cron/staleness-alerts/route.ts` | GET | yes | cron secret guard | no | no | no/implicit | OK (no obvious control gap in handler) |
| `app/api/cron/supervision-checks/route.ts` | GET | no | cron secret guard | no | n/a | no/implicit | OK (no obvious control gap in handler) |
| `app/api/debug/db-counts/route.ts` | GET | no | none found | no | n/a | no/implicit | FLAG (no clear auth guard; possible detailed error leakage) |
| `app/api/exports/billing/route.ts` | GET | yes | authorization header check | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/exports/payroll/route.ts` | GET | yes | none found | no | n/a | yes | FLAG (no clear auth guard) |
| `app/api/health/route.ts` | GET | no | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/hr-tasks/[id]/bt-upload/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/hr-tasks/[id]/hr-file/route.ts` | GET | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/mapbox/autocomplete/route.ts` | GET | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/mapbox/details/route.ts` | GET | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/mcp/route.ts` | DELETE | no | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/mcp/route.ts` | GET | no | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/mcp/route.ts` | OPTIONS | no | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/mcp/route.ts` | POST | no | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/mobile/sync/time-entry/route.ts` | POST | yes | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/oauth/authorize/route.ts` | GET | yes | none found | no | n/a | yes | FLAG (no clear auth guard) |
| `app/api/oauth/authorize/route.ts` | POST | yes | authorization header check | no | n/a | yes | OK (no obvious control gap in handler) |
| `app/api/oauth/register/route.ts` | OPTIONS | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/oauth/register/route.ts` | POST | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/oauth/token/route.ts` | OPTIONS | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/oauth/token/route.ts` | POST | yes | authorization header check | no | n/a | no/implicit | OK (no obvious control gap in handler) |
| `app/api/onboarding/acknowledge/route.ts` | POST | yes | none found | no | no | yes | FLAG (no clear auth guard) |
| `app/api/onboarding/notice-receipt/route.ts` | POST | yes | none found | no | no | yes | FLAG (no clear auth guard) |
| `app/api/onboarding/pdf/upload/route.ts` | POST | yes | none found | no | no | yes | FLAG (no clear auth guard) |
| `app/api/operations/reconcile/route.ts` | POST | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/profile/route.ts` | GET | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/profile/route.ts` | PATCH | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/profile/sessions/[sessionId]/route.ts` | DELETE | no | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/profile/sessions/route.ts` | DELETE | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/public/apply/draft/route.ts` | POST | no | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/public/apply/submit/route.ts` | POST | yes | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/public/apply/upload/route.ts` | POST | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/public/calendar/ics/route.ts` | GET | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/public/company-docs/[token]/file/route.ts` | GET | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/public/company-docs/[token]/route.ts` | GET | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/public/company-docs/[token]/sign/route.ts` | POST | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/public/company-docs/[token]/view/route.ts` | POST | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/public/interviewer-slots/route.ts` | GET | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/public/interviewers/route.ts` | GET | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/public/schedule-interview/route.ts` | POST | yes | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/public/validate-scheduling-token/route.ts` | GET | yes | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/rbt/availability/route.ts` | GET | yes | none found | no | no | yes | FLAG (no clear auth guard; possible detailed error leakage) |
| `app/api/rbt/availability/route.ts` | POST | yes | none found | no | no | yes | FLAG (no clear auth guard; possible detailed error leakage) |
| `app/api/rbt/client-info/route.ts` | GET | yes | none found | no | no | yes | FLAG (no clear auth guard) |
| `app/api/rbt/documents/company-dist/[id]/file/route.ts` | GET | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/rbt/documents/company/[id]/download/route.ts` | GET | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/rbt/documents/company/[id]/sign/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/rbt/documents/company/[id]/upload/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/rbt/documents/company/[id]/view/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/rbt/documents/company/route.ts` | GET | yes | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/rbt/documents/my/[documentId]/download/route.ts` | GET | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/rbt/documents/route.ts` | GET | yes | none found | no | no | yes | FLAG (no clear auth guard; possible detailed error leakage) |
| `app/api/rbt/esign-consent/route.ts` | POST | yes | none found | no | no | yes | FLAG (no clear auth guard) |
| `app/api/rbt/leave-requests/route.ts` | POST | yes | none found | no | no | yes | FLAG (no clear auth guard) |
| `app/api/rbt/messages/read/route.ts` | POST | yes | none found | no | no | yes | FLAG (no clear auth guard) |
| `app/api/rbt/messages/route.ts` | GET | yes | none found | no | no | yes | FLAG (no clear auth guard; possible detailed error leakage) |
| `app/api/rbt/messages/route.ts` | POST | yes | none found | no | no | yes | FLAG (no clear auth guard; possible detailed error leakage) |
| `app/api/rbt/onboarding-package/download/route.ts` | GET | yes | none found | no | no | yes | FLAG (no clear auth guard) |
| `app/api/rbt/onboarding-tasks/[id]/complete/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/rbt/onboarding-tasks/[id]/sign/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/rbt/onboarding-tasks/[id]/upload-files/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/rbt/onboarding-tasks/[id]/upload/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/rbt/onboarding-tasks/route.ts` | GET | yes | none found | no | no | yes | FLAG (no clear auth guard) |
| `app/api/rbt/onboarding/completions/[documentId]/downloaded/route.ts` | PATCH | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/rbt/onboarding/documents/[documentId]/pdf/route.ts` | GET | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/rbt/onboarding/documents/[documentId]/upload/route.ts` | POST | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/rbt/onboarding/progress/route.ts` | GET | yes | none found | no | no | yes | FLAG (no clear auth guard) |
| `app/api/rbt/onboarding/quiz/status/route.ts` | GET | yes | none found | no | no | yes | FLAG (no clear auth guard) |
| `app/api/rbt/onboarding/quiz/submit/route.ts` | POST | yes | none found | no | no | yes | FLAG (no clear auth guard) |
| `app/api/rbt/pay/statements/[id]/route.ts` | GET | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/rbt/pay/statements/route.ts` | GET | yes | none found | no | no | yes | FLAG (no clear auth guard) |
| `app/api/rbt/pay/stubs/[id]/route.ts` | GET | no | none found | no | no | no/implicit | FLAG (no clear auth guard) |
| `app/api/rbt/pay/stubs/route.ts` | GET | yes | none found | no | no | yes | FLAG (no clear auth guard) |
| `app/api/rbt/pay/summary/route.ts` | GET | yes | none found | no | no | yes | FLAG (no clear auth guard) |
| `app/api/rbt/resources/upload/route.ts` | POST | yes | none found | no | no | yes | FLAG (no clear auth guard) |
| `app/api/rbt/schedule/route.ts` | GET | yes | none found | no | no | yes | FLAG (no clear auth guard) |
| `app/api/schedule/client-boroughs/route.ts` | GET | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/schedule/client-boroughs/route.ts` | PATCH | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/schedule/data/route.ts` | GET | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/schedule/import/candidates/route.ts` | GET | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/schedule/import/commit/route.ts` | POST | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/schedule/import/preview/route.ts` | POST | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/schedule/periods/route.ts` | DELETE | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/schedule/periods/route.ts` | GET | yes | none found | no | n/a | no/implicit | FLAG (no clear auth guard) |
| `app/api/supervision/events/route.ts` | GET | yes | none found | no | n/a | yes | FLAG (no clear auth guard) |
| `app/api/supervision/events/route.ts` | POST | yes | none found | no | n/a | yes | FLAG (no clear auth guard) |

## Endpoint Table — Server Actions

| Action | Function | Reads/Writes | Touches PHI | CS Elevation | Per-object Assertion | Role Gate | Verdict |
|---|---|---|---|---|---|---|---|
| `lib/crm/actions.ts` | `updateClientNextAction` | writes next action PHI | yes | yes | assertCanEditClient | via access.ts | OK |
| `lib/crm/actions.ts` | `advanceStage` | mutates stage/history/requirements | yes | yes | assertCanEditClient | via access.ts | OK |
| `lib/crm/actions.ts` | `setStage` | manual stage override | yes | yes | assertCanEditClient | full-access required | OK |
| `lib/crm/actions.ts` | `createServiceClient` | creates client PHI record | yes | yes | n/a create | full-access required | OK |
| `lib/crm/actions.ts` | `updateTreatmentPlanStatus` | mutates clinical milestone | yes | yes | assertCanEditClient | via access.ts | OK |
| `lib/crm/actions.ts` | `updateRbtTargetDate` | mutates staffing target | yes | yes | assertCanEditClient | via access.ts | OK |
| `lib/crm/actions.ts` | `updateClientPreferences` | mutates client prefs | yes | yes | assertCanEditClient | via access.ts | OK |
| `lib/crm/actions.ts` | `updateClientOverview` | mutates demographics/insurance | yes | yes | assertCanEditClient | via access.ts | OK |
| `lib/crm/actions.ts` | `updateRequirement` | requirement by id -> parent client assert | yes | yes | yes (child->parent) | via access.ts | OK |
| `lib/crm/actions.ts` | `attestRequirementOnFile` | delegates updateRequirement | yes | yes | yes (child->parent) | via access.ts | OK |
| `lib/crm/actions.ts` | `markRequirementReceived` | delegates updateRequirement | yes | yes | yes (child->parent) | via access.ts | OK |
| `lib/crm/actions.ts` | `saveConsentInitials` | consent initials mutation | yes | yes | assertCanEditClient | via access.ts | FLAG (LOW validation) |
| `lib/crm/actions.ts` | `signClientConsent` | legal consent + IP | yes | yes | assertCanEditClient | via access.ts | OK |
| `lib/crm/actions.ts` | `saveReferralCheck` | clinical referral data | yes | yes | assertCanEditClient | via access.ts | OK |
| `lib/crm/actions.ts` | `addClientNote` | client note write | yes | yes | assertCanEditClient | via access.ts | OK |
| `lib/crm/actions.ts` | `logParentContact` | comm log write | yes | yes | assertCanEditClient | via access.ts | OK |
| `lib/crm/actions.ts` | `setPipelineStatus` | status + break mutation | yes | yes | assertCanEditClient | via access.ts | OK |
| `lib/crm/actions.ts` | `searchRbtProfiles` | staff directory lookup | no | yes | n/a | client-services auth only | OK |
| `lib/crm/actions.ts` | `searchBcbaProfiles` | staff directory lookup | no | yes | n/a | client-services auth only | OK |
| `lib/crm/actions.ts` | `createAuthorization` | auth header write | yes | yes | assertCanEditClient | via access.ts | OK |
| `lib/crm/actions.ts` | `updateAuthorization` | auth by id -> parent client assert | yes | yes | yes (child->parent) | via access.ts | OK |
| `lib/crm/actions.ts` | `addAuthorizationLine` | line by auth id -> parent assert | yes | yes | yes (child->parent) | via access.ts | OK |
| `lib/crm/actions.ts` | `updateAuthorizationLine` | line id -> parent client assert | yes | yes | yes (child->parent) | via access.ts | OK |
| `lib/crm/actions.ts` | `deleteAuthorizationLine` | line soft-delete with parent assert | yes | yes | yes (child->parent) | via access.ts | OK |
| `lib/crm/actions.ts` | `assignRbt` | care-team assignment | yes | yes | assertCanEditClient | via access.ts | OK |
| `lib/crm/actions.ts` | `updateRbtAssignment` | assignment id -> parent assert | yes | yes | yes (child->parent) | via access.ts | OK |
| `lib/crm/actions.ts` | `removeRbtAssignment` | assignment soft-delete | yes | yes | yes (child->parent) | via access.ts | OK |
| `lib/crm/actions.ts` | `assignBcba` | clinical assignment | yes | yes | assertCanEditClient | via access.ts | OK |
| `lib/crm/actions.ts` | `flagRbtReplacement` | break + alert write | yes | yes | assertCanEditClient | via access.ts | OK |
| `lib/crm/actions.ts` | `addScheduleEntry` | schedule write on client profile | yes | yes | assertCanEditClient | via access.ts | OK |
| `lib/crm/actions.ts` | `addScheduleEntries` | bulk schedule writes on profile | yes | yes | assertCanEditClient | via access.ts | OK |
| `lib/crm/actions.ts` | `updateScheduleEntry` | schedule id -> parent client assert | yes | yes | yes (child->parent) | via access.ts | OK |
| `lib/crm/actions.ts` | `removeScheduleEntry` | schedule soft-delete via parent assert | yes | yes | yes (child->parent) | via access.ts | OK |
| `lib/crm/actions.ts` | `logCommunication` | client communication log | yes | yes | assertCanEditClient | via access.ts | OK |
| `lib/crm/actions.ts` | `previewClientEmail` | delegates to staffSend checks | yes | yes | delegated assertCanEditClient | claim/cc/full gate | OK |
| `lib/crm/actions.ts` | `sendClientEmail` | delegates to staffSend checks | yes | yes | delegated assertCanEditClient | claim/cc/full gate | OK |
| `lib/crm/actions.ts` | `resendJourneyEmail` | journey resend | yes | yes | assertCanEditClient | full-access required | OK |
| `lib/crm/actions.ts` | `softDeleteServiceClient` | family soft-delete | yes | yes | assertCanEditClient | full-access required | OK |
| `lib/crm/actions.ts` | `restoreServiceClient` | family restore | yes | yes | deleted-row restore path | full-access required | OK |
| `lib/crm/actions.ts` | `listDeletedServiceClients` | reads deleted family list | yes | yes | n/a | full-access required | OK |
| `lib/crm/actions.ts` | `listBoardMigrationReview` | reads migrated schedule rows | yes | yes | n/a | full-access required | OK |
| `lib/crm/actions.ts` | `confirmBoardMigrationRow` | confirms migrated row | yes | yes | no per-client assert | full-access required | OK |
| `lib/crm/actions.ts` | `discardBoardMigrationRow` | discards migrated row | yes | yes | no per-client assert | full-access required | OK |
| `lib/crm/ownershipActions.ts` | `claimClient` | claim ownership grant | yes | yes | department ownership checks | server role checks | OK |
| `lib/crm/ownershipActions.ts` | `releaseClient` | release claim | yes | yes | claimer/manager checks | server role checks | OK |
| `lib/crm/ownershipActions.ts` | `assignClient` | assign owner user | yes | yes | assertCanEditClient | server role checks | OK |
| `lib/crm/ownershipActions.ts` | `assignCaseCoordinator` | assign CC | yes | yes | manager/super-admin gate | server role checks | OK |
| `lib/crm/ownershipActions.ts` | `listCaseCoordinators` | read CC roster | no | yes | n/a | manager/super-admin gate | OK |
| `lib/crm/ownershipActions.ts` | `reassignOwnerDept` | dept handoff mutation | yes | yes | assertCanEditClient | server role checks | OK |
| `lib/crm/ownershipActions.ts` | `listDepartmentAssignees` | read assignee roster | no | yes | n/a | server role checks | OK |
| `lib/crm/roleActions.ts` | `listCrmUsersWithRoles` | reads role roster | no | yes | n/a | assertCrmSuperAdmin | OK |
| `lib/crm/roleActions.ts` | `grantCrmRole` | role mutation | no | yes | n/a | assertCrmSuperAdmin | OK |
| `lib/crm/roleActions.ts` | `revokeCrmRole` | role mutation | no | yes | n/a | assertCrmSuperAdmin | OK |
| `lib/schedule/actions.ts` | `createSlot` | schedule slot write | yes | no | none | assertCrmScheduleUser only | FLAG (HIGH) |
| `lib/schedule/actions.ts` | `updateSlot` | schedule slot update by id | yes | no | none | assertCrmScheduleUser only | FLAG (HIGH) |
| `lib/schedule/actions.ts` | `deleteSlot` | schedule slot soft-delete by id | yes | no | none | assertCrmScheduleUser only | FLAG (HIGH) |
| `lib/schedule/actions.ts` | `moveSlot` | delegates updateSlot | yes | no | none | assertCrmScheduleUser only | FLAG (HIGH) |
| `lib/schedule/actions.ts` | `duplicateSlot` | duplicates slot by id | yes | no | none | assertCrmScheduleUser only | FLAG (HIGH) |
| `lib/schedule/actions.ts` | `bulkUpdateSlots` | bulk update by ids | yes | no | none | assertCrmScheduleUser only | FLAG (HIGH) |
| `lib/schedule/actions.ts` | `bulkDeleteSlots` | bulk soft-delete by ids | yes | no | none | assertCrmScheduleUser only | FLAG (HIGH) |
| `lib/schedule/actions.ts` | `upsertClient` | updates linked client meta | yes | no | none | assertCrmScheduleUser only | FLAG (HIGH) |
| `lib/schedule/actions.ts` | `upsertTherapist` | upserts therapist surrogate | no | no | n/a | assertCrmScheduleUser only | OK |
| `lib/schedule/actions.ts` | `updateTherapistBorough` | updates therapist borough | no | no | n/a | assertCrmScheduleUser only | OK |
| `lib/schedule/actions.ts` | `setAuthorizedHours` | delegates updateClientMeta | yes | no | none | assertCrmScheduleUser only | FLAG (HIGH) |
| `lib/schedule/actions.ts` | `updateClientMeta` | updates client borough/hours by id | yes | no | none | assertCrmScheduleUser only | FLAG (HIGH) |
| `lib/schedule/actions.ts` | `addAllowedUser` | ACL mutation | no | no | n/a | assertCrmScheduleUser only | FLAG (HIGH) |
| `lib/schedule/actions.ts` | `removeAllowedUser` | ACL mutation | no | no | n/a | assertCrmScheduleUser only | FLAG (HIGH) |
| `lib/client-services/unlock.ts` | `unlockClientServices` | elevation session create | yes | yes | n/a | canAccessClientServices + rate limit | OK |
| `lib/client-services/unlock.ts` | `requireClientServicesSessionOrRedirect` | elevation guard | yes | yes | n/a | server-side redirect guard | OK |

## Cron/Webhook Check
- Cron routes reviewed from `app/api/cron/**` and checked for secret-based guards (`assertCronOrResponse` / `assertCrmCronOrResponse` / equivalent).
- No confirmed cron route missing secret gate in this pass.
- Follow-up recommended: manually verify response bodies never include PHI payloads beyond counts/status.
