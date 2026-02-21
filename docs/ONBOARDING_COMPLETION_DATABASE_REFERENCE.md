# How to know which RBT completed onboarding (database reference)

The HRM uses **two** places to track onboarding progress. Together they define “completed onboarding.”

---

## 1. Table: `onboarding_tasks`

**Purpose:** Checklist tasks per RBT (download doc, upload signed doc, video course, signature, forty-hour certificate, etc.).

| Column | Type | Meaning |
|--------|------|--------|
| `id` | TEXT | Primary key. |
| `rbtProfileId` | TEXT | RBT (FK to `rbt_profiles.id`). |
| `taskType` | TEXT | e.g. `DOWNLOAD_DOC`, `UPLOAD_SIGNED_DOC`, `VIDEO_COURSE`, `SIGNATURE`, `FORTY_HOUR_COURSE_CERTIFICATE`, `PACKAGE_UPLOAD`. |
| `title` | TEXT | Task title. |
| `isCompleted` | BOOLEAN | **`true` = this task is done for this RBT.** |
| `completedAt` | TIMESTAMPTZ | When the task was completed (optional). |

**How to tell if an RBT completed all tasks (task-only view):**

- For that RBT, every row in `onboarding_tasks` with that `rbtProfileId` has `isCompleted = true`.
- The admin onboarding page excludes `PACKAGE_UPLOAD` when counting; so “task completion” there = all **non–PACKAGE_UPLOAD** tasks have `isCompleted = true`.

**Example SQL – RBTs who have completed all their (non–package) tasks:**

```sql
-- Assumes you treat "completed tasks" as all task types except PACKAGE_UPLOAD
SELECT "rbtProfileId"
FROM onboarding_tasks
WHERE "taskType" != 'PACKAGE_UPLOAD'
GROUP BY "rbtProfileId"
HAVING COUNT(*) FILTER (WHERE "isCompleted" = false) = 0;
```

**Example SQL – RBTs who have at least one task not completed:**

```sql
SELECT "rbtProfileId"
FROM onboarding_tasks
WHERE "isCompleted" = false
  AND "taskType" != 'PACKAGE_UPLOAD'
GROUP BY "rbtProfileId";
```

---

## 2. Table: `onboarding_completions`

**Purpose:** Per-RBT, per-document completion for onboarding **documents** (acknowledgments, fillable PDFs from `onboarding_documents`).

| Column | Type | Meaning |
|--------|------|--------|
| `id` | TEXT | Primary key. |
| `rbtProfileId` | TEXT | RBT (FK to `rbt_profiles.id`). |
| `documentId` | TEXT | Onboarding document (FK to `onboarding_documents.id`). |
| `status` | TEXT | **`NOT_STARTED` \| `IN_PROGRESS` \| `COMPLETED`**. **`COMPLETED` = this document is done for this RBT.** |
| `completedAt` | TIMESTAMPTZ | When it was completed (optional). |

**How to tell if an RBT completed all documents:**

- For every **active** onboarding document (in `onboarding_documents` where `isActive = true`), there is a row in `onboarding_completions` for that `rbtProfileId` and `documentId` with `status = 'COMPLETED'`.

**Example SQL – RBTs who have completed all active onboarding documents:**

```sql
SELECT oc."rbtProfileId"
FROM onboarding_documents od
CROSS JOIN (SELECT DISTINCT "rbtProfileId" FROM onboarding_completions) rbt
LEFT JOIN onboarding_completions oc
  ON oc."documentId" = od.id AND oc."rbtProfileId" = rbt."rbtProfileId" AND oc.status = 'COMPLETED'
WHERE od."isActive" = true
GROUP BY oc."rbtProfileId", rbt."rbtProfileId"
HAVING COUNT(od.id) = COUNT(oc.id);
```

(Simpler approach: for each RBT, count completions with `status = 'COMPLETED'` and compare to count of active documents.)

---

## 3. How the app defines “completed onboarding”

- **Admin onboarding page** (`/admin/onboarding`): Uses only **onboarding_tasks**. It loads HIRED RBTs and their tasks, then computes `completed / total` (excluding `PACKAGE_UPLOAD`). **“Completed onboarding” there = 100% of those tasks have `isCompleted = true`.**
- **RBT dashboard**: Uses **both**:
  - All **onboarding_tasks** (excluding package upload) must have `isCompleted = true`.
  - All **onboarding_documents** (that the RBT must do) must have an **onboarding_completions** row with `status = 'COMPLETED'`.

So for a single source of truth:

- **Task-only:** Use `onboarding_tasks`: for each `rbtProfileId`, require `COUNT(*) FILTER (WHERE "isCompleted" = false AND "taskType" != 'PACKAGE_UPLOAD') = 0`.
- **Full (tasks + documents):** Use both tables: same as above for tasks, and for every active `onboarding_documents` row there is an `onboarding_completions` row for that RBT with `status = 'COMPLETED'`.

---

## 4. Quick reference

| Question | Table | Column(s) |
|----------|--------|-----------|
| Is this single task done for this RBT? | `onboarding_tasks` | `isCompleted = true` (and optionally `completedAt`) |
| Is this document done for this RBT? | `onboarding_completions` | `status = 'COMPLETED'` (and optionally `completedAt`) |
| Which RBTs completed all tasks? | `onboarding_tasks` | For each `rbtProfileId`, no row with `isCompleted = false` (excluding `PACKAGE_UPLOAD` if you match the app). |
| Which RBTs completed all documents? | `onboarding_completions` + `onboarding_documents` | For each RBT, every active document has a completion row with `status = 'COMPLETED'`. |

All of this lives in the **same HRM database** (the one in the HRM’s `DATABASE_URL` / Supabase project).
