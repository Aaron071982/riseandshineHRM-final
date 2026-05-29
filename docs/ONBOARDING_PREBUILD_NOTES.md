# Onboarding pre-build notes (audit cleanup)

## Active RBT onboarding UI

| Route / component | Role |
|-----------------|------|
| `/rbt/tasks` → `OnboardingWizard` | Primary checklist + e-sign document flows |
| `AcknowledgmentFlow` | Typed-name acknowledgments |
| `FillablePdfFlow` | Fillable PDF upload path (`POST /api/onboarding/pdf/upload`) |
| `/rbt/documents` | View signed company docs and personal uploads |
| `/rbt/dashboard` | Progress summary; gates schedule and sessions |

## Removed (dead) UI / APIs

- `OnboardingDashboard` (replaced by wizard on `/rbt/tasks`)
- `OnboardingAdminActions`, `SuperAdminActivityLogs`, `UserSettingsPage`, `RBTMainDashboard`, `TeamHubPage`, admin `RBTProfileView`
- APIs: `/api/onboarding/docs`, `status`, `submit-all`, `pdf/draft`, `pdf/finalize`

## Dual systems (design for new build)

1. **`OnboardingTask`** — legacy checklist (HIPAA package, SSN, 40-hr cert, signature pad).
2. **`OnboardingDocument` / `OnboardingCompletion`** — catalog e-sign + fillable PDFs.

New `OnboardingDocumentCategory` fields extend the document catalog; do not remove `OnboardingTask` until migration plan is explicit.

## Production SQL (Supabase)

If **HR-Initiated Documents** shows “table is missing”, run:

`prisma/scripts/create-hr-document-tasks-table.sql`

If the table exists but **Send to RBT** email tracking fails, run:

`prisma/scripts/add-hr-document-email-columns.sql`
