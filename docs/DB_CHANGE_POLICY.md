# Database change policy (live PHI)

This system holds **real family PHI**. Schema and data changes follow this policy. Cursor does **not** write to production.

## Environments

| Environment | How to target | Allowed operations |
|---|---|---|
| **Dev** (`riseandshine-hrm-dev`) | `.env.development` + `DEV_SUPABASE_REF` | `npm run db:push:dev`, `npm run db:rls:dev`, seed with `--confirm` |
| **Prod** | Aaron only, after backup | Reviewed **forward SQL** (`psql` / Supabase SQL editor). Never `db push`. Never `migrate reset`. |

## Prod changes

1. Take a **manual Supabase backup** (Dashboard → Database → Backups) before every prod migration.
2. Ship **reviewed forward SQL only** — additive `ALTER TABLE … ADD COLUMN`, indexes, RLS `ENABLE` / `CREATE POLICY`.
3. Read the SQL for unexpected `DROP`, `TRUNCATE`, `DELETE FROM`, or `CASCADE` before apply.
4. Snapshot family row counts **before** and **after**:

   ```bash
   dotenv -e .env.development -- tsx scripts/family-row-counts.ts --snapshot /tmp/family-before.json
   # apply migration
   dotenv -e .env.development -- tsx scripts/family-row-counts.ts --compare /tmp/family-before.json
   ```

   Against prod, Aaron runs the same script with `--prod-confirm` (dry-run is default; the script only reads counts).
5. Apply RLS with `prisma/rls/apply-rls.sql` as a **deliberate go-live step** (see below). Do not rely on `db push` to create policies.

## Go-live: RLS SQL on prod

`user_crm_roles` (and any other public table the catch-all finds) must have RLS enabled with the standard 3-policy pattern (`*_service_role_all`, `*_postgres_all`, `*_block_anon`).

After a backup:

```bash
psql "$PROD_DIRECT_URL" -v ON_ERROR_STOP=1 -f prisma/rls/apply-rls.sql
```

Then verify with the anon/publishable key that `user_crm_roles` returns **no rows**.

Cursor must not run this against prod.

## Write scripts

Every script that can write to the DB:

- Prints the **target DB host** first.
- **Dry-runs by default**; writes only with `--confirm`.
- **Refuses prod** unless `--prod-confirm` (alias `--allow-prod`) is passed. Seed/wipe scripts refuse prod even with that flag.

Helper: `lib/scripts/guard.ts` → `assertWriteTarget({ allowProd })`.

## Family records

Family-related tables use **soft-delete** (`deletedAt` / `deletedByUserId`). App code must not `DELETE` those rows. Restore is full-access only and is audited.

## Phase 14: schedule consolidation (prod)

`rbt_schedule_assignments` is the single live schedule. `session_slot` / `therapist` / `schedule_client` stay in the database but are not written or read for the live board.

After a **manual Supabase backup** and a family-count snapshot:

```bash
# 1. Additive columns (reviewStatus, boardSlotId, BOARD_MIGRATION enum)
psql "$PROD_DIRECT_URL" -v ON_ERROR_STOP=1 -f prisma/scripts/add-schedule-review-status.sql

# 2. Snapshot, then migrate board-only session_slot rows as provisional (not live)
dotenv -e .env -- tsx scripts/family-row-counts.ts --prod-confirm --snapshot /tmp/family-before.json
dotenv -e .env -- tsx scripts/migrate-board-slots.ts --prod-confirm
dotenv -e .env -- tsx scripts/migrate-board-slots.ts --prod-confirm --confirm --report /tmp/board-mig-prod.json
dotenv -e .env -- tsx scripts/family-row-counts.ts --prod-confirm --compare /tmp/family-before.json
```

Expected delta: `rbt_schedule_assignments` total/live increase by the migrated board-only count (provisional `isActive=false`, `reviewStatus=PENDING`). No other family tables should change. Unresolved RBT matches are reported, not inserted.

Cursor must not run these against prod. Confirm/discard is full-access in the CRM (Schedule page + Admin).

## Phase 16: requirements regrouping + consent (prod)

Additive schema: `ON_FILE` status, `group` / attestation columns, `client_consents`, `client_referral_checks`, `DOC_EXPIRING` alert. Existing `client_requirements` rows are **remapped, never dropped**.

After a **manual Supabase backup** and a family-count snapshot:

```bash
psql "$PROD_DIRECT_URL" -v ON_ERROR_STOP=1 -f prisma/scripts/add-requirement-attestation-consent.sql
dotenv -e .env -- tsx scripts/family-row-counts.ts --prod-confirm --snapshot /tmp/family-before.json
dotenv -e .env -- tsx scripts/migrate-requirement-keys.ts --prod-confirm
dotenv -e .env -- tsx scripts/migrate-requirement-keys.ts --prod-confirm --confirm
dotenv -e .env -- tsx scripts/family-row-counts.ts --prod-confirm --compare /tmp/family-before.json
```

Expected: `client_requirements` live count stays the same or **increases** (missing canonical keys inserted). No hard deletes. `client_consents` / `client_referral_checks` start empty until staff fill them.

Cursor must not run these against prod.

## Phase 17: claim-scoped access (prod)

Additive schema: `ClaimSource` enum + `client_claims` table. Existing `currentOwnerUserId` / `caseCoordinatorUserId` are **copied into grants, never cleared**.

After a **manual Supabase backup** and a family-count snapshot:

```bash
psql "$PROD_DIRECT_URL" -v ON_ERROR_STOP=1 -f prisma/scripts/add-client-claims.sql
dotenv -e .env -- tsx scripts/family-row-counts.ts --prod-confirm --snapshot /tmp/family-before.json
dotenv -e .env -- tsx scripts/migrate-client-claims.ts --prod-confirm
dotenv -e .env -- tsx scripts/migrate-client-claims.ts --prod-confirm --confirm
dotenv -e .env -- tsx scripts/family-row-counts.ts --prod-confirm --compare /tmp/family-before.json
```

Expected: `client_claims` grows; family tables unchanged. Then apply RLS (`prisma/rls/apply-rls.sql`) so `client_claims` gets the standard 3-policy pattern.

Cursor must not run these against prod.


