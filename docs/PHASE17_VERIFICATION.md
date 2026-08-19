# Phase 17 verification — claim-scoped access

Walk this on **dev** (`http://localhost:3000`) with a Client Services elevated session. Do not use production.

Role users (HRM `ADMIN` so they can enter CS; CRM role gates visibility):

| Email | CRM role | What they should see |
|---|---|---|
| `intake-only@example.com` | INTAKE | Claimed clients + Intake name/stage pool |
| `clinical-only@example.com` | CLINICAL | Claimed clients + Clinical name/stage pool |
| `cc-only@example.com` | CASE_COORDINATION | Assigned Upcoming / Ready only — **no** self-claim |
| `full-visibility@example.com` | MANAGEMENT | All clients, all stages, who claimed/owns what |

**Login:** `/login` → email above → OTP **`123456`** (localhost bypass). Then unlock Client Services.

Seed / refresh users (dev only):

```bash
dotenv -e .env.development -- tsx scripts/seed-phase17-role-users.ts --confirm
```

---

## 1. Unclaimed profile is 403

1. Log in as `intake-only@example.com`.
2. Open **Intake** queue. The unclaimed pool shows **name + current stage only** — no DOB, address, insurance, parent info, and **no profile link**.
3. Copy a client id from a full-visibility session (or the URL of an unclaimed family).
4. As intake, open `/client-services/clients/<that-id>` **without claiming**.
5. **Expected:** Access denied (server 403). Network tab: the document/API response is 403, not an empty shell of PHI.

## 2. Claim opens the profile and leaves others’ pool

1. Still as intake, **Claim** one unclaimed Intake family.
2. Profile opens. You can edit Intake-owned fields.
3. Log out. Log in as `full-visibility@example.com` (or a second Intake user if you create one).
4. That family is **gone** from the unclaimed pool (exclusive claim).
5. On the original intake user’s **Clients** tab, the family appears.

## 3. Release keeps history and returns to the pool

1. As the claimer, **Release**.
2. Family returns to the Intake unclaimed pool (name + stage).
3. **Clients** tab still lists them (ever-claimed view). Opening the profile still works (view). Editing Intake fields still works only while Intake owns the stage.

## 4. Ever-claimed view after hand-off; edit needs current dept

1. Claim an Intake family again.
2. **Hand off** to Clinical (reason required). Stage stays the same; owner dept becomes Clinical.
3. Intake user: family **leaves** the Intake queue. **Clients** tab still shows them at the current stage.
4. Open the profile as intake: **view-only** — advance / requirements writes return 403.
5. `clinical-only@example.com` sees them in the Clinical **unclaimed** pool (name + stage). They cannot open the profile until they claim.

## 5. Cannot open another department’s unclaimed client

1. As intake, do **not** claim a Clinical-owned family.
2. Paste that client’s profile URL.
3. **Expected:** 403.

## 6. Claimable pool PHI

1. As intake, inspect the Intake queue payload (server render — no extra fields on pool cards).
2. Confirm cards show only name + stage. No DOB, insurance, parent, address, client code on **unclaimed** cards.

Automated: `lib/crm/claims.test.ts` asserts `CLAIMABLE_POOL_SELECT` is `{ id, firstName, lastName, stage }`.

## 7. Case Coordination assignment (not self-claim)

1. Log in as `cc-only@example.com`. Open **Case coordination**.
2. There is **no Claim** button on a pool. Upcoming / Ready are assignment piles.
3. Log in as `full-visibility@example.com`. Open Case coordination.
4. **Unassigned** pile: name + stage + coordinator dropdown (users with `CASE_COORDINATION`).
5. Assign `cc-only@example.com`.
6. Log back in as CC: the family is in **Upcoming** if stage is before `RBT_ASSIGNED`, or **Ready** from `RBT_ASSIGNED` onward.
7. Full-visibility still sees all coordinators and who is assigned to whom.

## 8. ACTIVE owned by Case Coordination + auth bounce-back

1. As full-visibility, open an **Active** client. Owner dept is **Case Coordination** (new default). Existing Active rows are not mass-rewritten.
2. As the assigned CC (or full-visibility), **Hand off** to Authorization with reason “auth renewal”.
3. **Stage stays ACTIVE.** Owner becomes Authorization. Family appears in Authorization’s unclaimed pool.
4. After Auth claims / finishes, hand off back to Case Coordination — CC grant (`ASSIGNED`) is still there.

## 9. Caseload, consent, email logo

1. **Caseload** column is **Insurance**, not Days in stage. **Active** group still shows hours receiving vs needed as the progress bar.
2. Requirements → consent: **no** “type legal name → Sign document”. Initials checkboxes remain. Satisfying action is **Upload / Mark received**.
3. Email tab → preview WELCOME: logo loads from `https://www.riseandshinehrm.com/new-real-logo.png` (not localhost / relative).

## 10. Full-visibility bypass

1. `full-visibility@example.com` (and allowlisted `irsal@` / `siyam@` / `kazi@` / `afsana@` / `shazia@` / `fardeen@` / `jaden@` riseandshineaba.com) can open any live client without claiming.
2. They see every department queue’s claimed work, not only their own.

---

## Grep — no profile bypass

From repo root:

```bash
rg -n "prisma\\.serviceClient\\.find(Unique|First|Many)" app/api/client-services lib/crm --glob '!*.test.ts'
```

Profile reads/writes for a `clientId` must call `assertCanViewClient` (read) or `assertCanEditClient` (write) first. Exceptions: claim from the pool (`claimClient` — no grant yet), list queries using `getVisibleClientsWhere`, and system/cron jobs.

```bash
rg -n "assertCanViewClient|assertCanEditClient" lib/crm app/api/client-services
```

---

## Automated

```bash
npx vitest run lib/crm/access.test.ts lib/crm/claims.test.ts lib/crm/departments.test.ts lib/crm/emails/staffEmail.test.ts
npx tsc --noEmit
```

Access tests cover: unclaimed → no view; ever-claimed view after hand-off; edit requires current dept; full-visibility sees all; Clients-tab where is grant-based.
