'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ClientOwnerDept } from '@prisma/client'
import {
  assignClient,
  claimClient,
  listDepartmentAssignees,
  reassignOwnerDept,
  releaseClient,
} from '@/lib/crm/ownershipActions'
import type { DepartmentQueueData, DepartmentQueueRow } from '@/lib/crm/departments'
import { OWNER_DEPT_LABELS, STAGE_LABELS } from '@/lib/crm/stages'
import { OwnerDeptBadge } from '@/components/crm/StageStepper'
import { cn } from '@/lib/utils'

const HANDOFF_DEPTS: ClientOwnerDept[] = [
  'INTAKE',
  'CLINICAL',
  'AUTHORIZATION',
  'STAFFING',
  'CASE_COORDINATION',
  'BILLING',
]

function FiveFieldSummary({ row }: { row: DepartmentQueueRow }) {
  return (
    <div className="grid gap-1 text-xs text-quiet sm:grid-cols-5 sm:gap-2">
      <div>
        <span className="block text-[10px] uppercase tracking-wide text-quiet">
          Stage
        </span>
        <span className="font-medium text-ink">{STAGE_LABELS[row.stage]}</span>
      </div>
      <div>
        <span className="block text-[10px] uppercase tracking-wide text-quiet">
          Owner
        </span>
        <OwnerDeptBadge dept={row.currentOwnerDept} />
      </div>
      <div className="sm:col-span-1">
        <span className="block text-[10px] uppercase tracking-wide text-quiet">
          Next action
        </span>
        <span className="line-clamp-2 font-medium text-ink">
          {row.nextAction || '—'}
        </span>
      </div>
      <div>
        <span className="block text-[10px] uppercase tracking-wide text-quiet">
          Due
        </span>
        <span className="font-medium tabular-nums text-ink">
          {row.nextActionDueAt
            ? new Date(row.nextActionDueAt).toLocaleDateString()
            : '—'}
        </span>
      </div>
      <div>
        <span className="block text-[10px] uppercase tracking-wide text-quiet">
          Days in stage
        </span>
        <span
          className={cn(
            'font-medium tabular-nums',
            row.stalled ? 'text-[var(--urgent)]' : 'text-ink'
          )}
        >
          {row.daysInStage}
          {row.stalled ? ' · stalled' : ''}
        </span>
      </div>
    </div>
  )
}

function DeptActions({
  row,
  dept,
  canManage,
  viewerUserId,
}: {
  row: DepartmentQueueRow
  dept: ClientOwnerDept
  canManage: boolean
  viewerUserId: string
}) {
  const detailHref = `/client-services/clients/${row.id}`
  const tab =
    dept === 'AUTHORIZATION'
      ? 'authorization'
      : dept === 'STAFFING'
        ? 'staffing'
        : dept === 'CLINICAL'
          ? 'clinical'
          : null

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <Link
        href={tab ? `${detailHref}?tab=${tab}` : detailHref}
        className="inline-flex h-8 items-center rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink hover:bg-line-2"
      >
        Open case
      </Link>
      {dept === 'INTAKE' && (
        <Link
          href={`${detailHref}?tab=requirements`}
          className="inline-flex h-8 items-center rounded-lg border border-line px-2.5 text-xs font-medium text-ink hover:bg-line-2"
        >
          Requirements
        </Link>
      )}
      {dept === 'AUTHORIZATION' && (
        <Link
          href={`${detailHref}?tab=authorization`}
          className="inline-flex h-8 items-center rounded-lg border border-line px-2.5 text-xs font-medium text-ink hover:bg-line-2"
        >
          Auth + RBT target
        </Link>
      )}
      {dept === 'STAFFING' && (
        <Link
          href={`/client-services/therapist-search?clientId=${encodeURIComponent(row.id)}`}
          className="inline-flex h-8 items-center rounded-lg bg-[var(--sunrise)] px-2.5 text-xs font-semibold text-[var(--espresso)] hover:opacity-90"
        >
          Take to Therapist Search
        </Link>
      )}
      {(canManage || row.currentOwnerUserId === viewerUserId) && (
        <span className="sr-only">claim actions below</span>
      )}
    </div>
  )
}

function CaseCard({
  row,
  dept,
  canManage,
  viewerUserId,
  mode,
}: {
  row: DepartmentQueueRow
  dept: ClientOwnerDept
  canManage: boolean
  viewerUserId: string
  mode: 'unclaimed' | 'claimed' | 'mine'
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showHandoff, setShowHandoff] = useState(false)
  const [handoffDept, setHandoffDept] = useState<ClientOwnerDept>(
    HANDOFF_DEPTS.find((d) => d !== dept) ?? 'STAFFING'
  )
  const [handoffReason, setHandoffReason] = useState('')
  const [showAssign, setShowAssign] = useState(false)
  const [assignees, setAssignees] = useState<
    { id: string; name: string | null; email: string | null }[]
  >([])
  const [assignTo, setAssignTo] = useState('')
  const canActOnOwnership =
    canManage || row.currentOwnerDept === dept

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error ?? 'Failed')
      else router.refresh()
    })
  }

  const openAssign = () => {
    setShowAssign(true)
    startTransition(async () => {
      const res = await listDepartmentAssignees(dept)
      if (res.ok) {
        setAssignees(res.users)
        if (res.users[0]) setAssignTo(res.users[0].id)
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <li className="rounded-xl border border-line bg-surface px-3 py-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <Link
          href={`/client-services/clients/${row.id}`}
          className="font-display text-sm font-semibold text-ink hover:underline"
        >
          {row.firstName} {row.lastName}{' '}
          <span className="font-sans text-xs font-normal text-quiet">
            {row.clientCode}
          </span>
        </Link>
        {mode === 'claimed' && row.ownerName && (
          <span className="text-xs text-quiet">Claimed by {row.ownerName}</span>
        )}
      </div>
      <FiveFieldSummary row={row} />
      {!canActOnOwnership && (
        <p className="mt-2 text-xs text-quiet">
          Shared with {OWNER_DEPT_LABELS[dept]} for parallel work. Ownership
          actions remain with{' '}
          {row.currentOwnerDept
            ? OWNER_DEPT_LABELS[row.currentOwnerDept]
            : 'the owning department'}.
        </p>
      )}
      <DeptActions
        row={row}
        dept={dept}
        canManage={canManage}
        viewerUserId={viewerUserId}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {canActOnOwnership && mode === 'unclaimed' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => claimClient(row.id))}
            className="inline-flex h-8 items-center rounded-lg bg-[var(--sunrise)] px-2.5 text-xs font-semibold text-[var(--espresso)] hover:opacity-90 disabled:opacity-50"
          >
            Claim
          </button>
        )}
        {canActOnOwnership &&
          (mode === 'claimed' || mode === 'mine') &&
          (row.currentOwnerUserId === viewerUserId || canManage) && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => releaseClient(row.id))}
              className="inline-flex h-8 items-center rounded-lg border border-line px-2.5 text-xs font-medium text-ink hover:bg-line-2 disabled:opacity-50"
            >
              Release
            </button>
          )}
        {canActOnOwnership && mode === 'claimed' && canManage && (
          <button
            type="button"
            disabled={pending}
            onClick={openAssign}
            className="inline-flex h-8 items-center rounded-lg border border-line px-2.5 text-xs font-medium text-ink hover:bg-line-2 disabled:opacity-50"
          >
            Reassign
          </button>
        )}
        {canActOnOwnership && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowHandoff((v) => !v)}
            className="inline-flex h-8 items-center rounded-lg border border-line px-2.5 text-xs font-medium text-ink hover:bg-line-2 disabled:opacity-50"
          >
            Hand off
          </button>
        )}
      </div>

      {showAssign && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-line-2/40 p-2">
          <label className="text-xs text-quiet">
            Assign to
            <select
              className="mt-1 block h-8 rounded-md border border-line bg-surface px-2 text-sm text-ink"
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
            >
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email ?? u.id}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={pending || !assignTo}
            onClick={() =>
              run(async () => {
                const res = await assignClient(row.id, assignTo)
                if (res.ok) setShowAssign(false)
                return res
              })
            }
            className="h-8 rounded-lg bg-[var(--sunrise)] px-2.5 text-xs font-semibold text-[var(--espresso)] disabled:opacity-50"
          >
            Confirm assign
          </button>
        </div>
      )}

      {showHandoff && (
        <div className="mt-3 space-y-2 rounded-lg border border-line bg-line-2/40 p-2">
          <label className="block text-xs text-quiet">
            Hand off to
            <select
              className="mt-1 block h-8 w-full rounded-md border border-line bg-surface px-2 text-sm text-ink"
              value={handoffDept}
              onChange={(e) =>
                setHandoffDept(e.target.value as ClientOwnerDept)
              }
            >
              {HANDOFF_DEPTS.filter((d) => d !== dept).map((d) => (
                <option key={d} value={d}>
                  {OWNER_DEPT_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-quiet">
            Reason
            <input
              className="mt-1 block h-8 w-full rounded-md border border-line bg-surface px-2 text-sm text-ink"
              value={handoffReason}
              onChange={(e) => setHandoffReason(e.target.value)}
              placeholder="e.g. Ready for RBT search"
            />
          </label>
          <button
            type="button"
            disabled={pending || !handoffReason.trim()}
            onClick={() =>
              run(async () => {
                const res = await reassignOwnerDept(
                  row.id,
                  handoffDept,
                  handoffReason
                )
                if (res.ok) {
                  setShowHandoff(false)
                  setHandoffReason('')
                }
                return res
              })
            }
            className="h-8 rounded-lg bg-[var(--espresso)] px-2.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Confirm hand-off
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-[var(--urgent)]" role="alert">
          {error}
        </p>
      )}
    </li>
  )
}

export default function DepartmentQueueClient({
  data,
}: {
  data: DepartmentQueueData
}) {
  const [ccTab, setCcTab] = useState<'dept' | 'mine'>('dept')
  const isCc = data.slug === 'case-coordination'

  const claimedByOwner = useMemo(() => {
    const map = new Map<string, DepartmentQueueRow[]>()
    for (const row of data.claimed) {
      const key = row.ownerName ?? row.currentOwnerUserId ?? 'Unknown'
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [data.claimed])

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          {data.label} queue
        </h1>
        <p className="mt-0.5 text-sm text-quiet">
          Cases this department owns or is ready to work in parallel. Claiming
          is available only to the owning department.
        </p>
      </div>

      {isCc && (
        <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
          <button
            type="button"
            onClick={() => setCcTab('dept')}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium',
              ccTab === 'dept'
                ? 'bg-[var(--sunrise)] text-[var(--espresso)]'
                : 'text-quiet hover:text-ink'
            )}
          >
            Department queue ({data.unclaimed.length + data.claimed.length})
          </button>
          <button
            type="button"
            onClick={() => setCcTab('mine')}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium',
              ccTab === 'mine'
                ? 'bg-[var(--sunrise)] text-[var(--espresso)]'
                : 'text-quiet hover:text-ink'
            )}
          >
            My caseload ({data.myCaseload?.length ?? 0})
          </button>
        </div>
      )}

      {(!isCc || ccTab === 'dept') && (
        <>
          <section>
            <h2 className="mb-2 font-display text-base font-semibold text-ink">
              Unclaimed ({data.unclaimed.length})
            </h2>
            {data.unclaimed.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-quiet">
                No unclaimed cases in this department.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.unclaimed.map((row) => (
                  <CaseCard
                    key={row.id}
                    row={row}
                    dept={data.dept}
                    canManage={data.canManage}
                    viewerUserId={data.viewerUserId}
                    mode="unclaimed"
                  />
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 font-display text-base font-semibold text-ink">
              Claimed ({data.claimed.length})
            </h2>
            {data.claimed.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-quiet">
                No claimed cases yet.
              </p>
            ) : (
              <div className="space-y-4">
                {claimedByOwner.map(([owner, rows]) => (
                  <div key={owner}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-quiet">
                      {owner}
                    </h3>
                    <ul className="space-y-3">
                      {rows.map((row) => (
                        <CaseCard
                          key={row.id}
                          row={row}
                          dept={data.dept}
                          canManage={data.canManage}
                          viewerUserId={data.viewerUserId}
                          mode="claimed"
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {isCc && ccTab === 'mine' && (
        <section>
          <h2 className="mb-2 font-display text-base font-semibold text-ink">
            My caseload ({data.myCaseload?.length ?? 0})
          </h2>
          {!data.myCaseload?.length ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-quiet">
              You have not claimed any cases yet. Use the department queue to
              claim work.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.myCaseload.map((row) => (
                <CaseCard
                  key={row.id}
                  row={row}
                  dept={row.currentOwnerDept ?? data.dept}
                  canManage={data.canManage}
                  viewerUserId={data.viewerUserId}
                  mode="mine"
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
