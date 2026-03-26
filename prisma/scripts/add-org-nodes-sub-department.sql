-- Add subgroup column for org chart (safe to re-run).
ALTER TABLE "org_nodes" ADD COLUMN IF NOT EXISTS "subDepartment" TEXT;

CREATE INDEX IF NOT EXISTS "org_nodes_department_subDepartment_idx" ON "org_nodes"("department", "subDepartment");
