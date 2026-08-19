'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ClientOwnerDept } from '@prisma/client'
import {
  assignCaseCoordinator,
  assignClient,
  claimClient,
  listDepartmentAssignees,
  reassignOwnerDept,
  releaseClient,
} from '@/lib/crm/ownershipActions'
import type { DepartmentQueueData, DepartmentQueueRow } from '@/lib/crm/departments'
import type { ClaimablePoolRow } from '@/lib/crm/claims'
import { OWNER_DEPT_LABELS, STAGE_LABELS } from '@/lib/crm/stages'
import { OwnerDeptBadge } from '@/components/crm/StageStepper'
import { ConfirmDestructiveDialog } from '@/components/crm/ConfirmDestructiveDialog'
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
      {row.billingSubstep && (
        <div className="sm:col-span-5">
          <span className="block text-[10px] uppercase tracking-wide text-quiet">
            Billing sub-step
          </span>
          <span className="font-medium text-ink">{row.billingSubstep}</span>
        </div>
      )}
    </div>
  )
}

function PoolCard({
  row,
  onClaim,
  pending,
  assignOptions,
  onAssign,
}: {
  row: ClaimablePoolRow
  onClaim?: () => void
  pending: boolean
  assignOptions?: { id: string; name: string | null; email: string | null }[]
  onAssign?: (userId: string) => void
}) {
  const [assignTo, setAssignTo] = useState(assignOptions?.[0]?.id ?? '')
  return (
    <li className="rounded-xl border border-line bg-surface px-3 py-3">
      <p className="font-display text-sm font-semibold text-ink">
        {row.firstName} {row.lastName}
      </p>
      <p className="mt-1 text-xs text-quiet">
        Stage: <span className="font-medium text-ink">{STAGE_LABELS[row.stage]}</span>
      </p>
      {onClaim && (
        <button
          type="button"
          disabled={pending}
          onClick={onClaim}
          className="mt-2 inline-flex h-8 items-center rounded-lg bg-[var(--sunrise)] px-2.5 text-xs font-semibold text-[var(--espresso)] hover:opacity-90 disabled:opacity-50"
        >
          Claim
        </button>
      )}
      {onAssign && assignOptions && assignOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-xs text-quiet">
            Assign coordinator
            <select
              className="mt-1 block h-8 rounded-md border border-line bg-surface px-2 text-sm text-ink"
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
            >
              {assignOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email ?? u.id}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={pending || !assignTo}
            onClick={() => onAssign(assignTo)}
            className="h-8 rounded-lg bg-[var(--sunrise)] px-2.5 text-xs font-semibold text-[var(--espresso)] disabled:opacity-50"
          >
            Assign
          </button>
        </div>
      )}
    </li>
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
  mode: 'claimed' | 'mine'
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showHandoff, setShowHandoff] = useState(false)
  const [handoffDept, setHandoffDept] = useState<ClientOwnerDept>(
    HANDOFF_DEPTS.find((d) => d !== dept) ?? 'STAFFING'
  )
  const [handoffReason, setHandoffReason] = useState('')
  const [confirmHandoff, setConfirmHandoff] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [assignees, setAssignees] = useState<
    { id: string; name: string | null; email: string | null }[]
  >([])
  const [assignTo, setAssignTo] = useState('')
  const canActOnOwnership = canManage || row.currentOwnerDept === dept
  const detailHref = `/client-services/clients/${row.id}`

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
          href={detailHref}
          className="font-display text-sm font-semibold text-ink hover:underline"
        >
          {row.firstName} {row.lastName}{' '}
          <span className="font-sans text-xs font-normal text-quiet">
            {row.clientCode}
          </span>
        </Link>
        {row.ownerName && (
          <span className="text-xs text-quiet">Claimed by {row.ownerName}</span>
        )}
      </div>
      <FiveFieldSummary row={row} />
      <div className="mt-2 flex flex-wrap gap-2">
        <Link
          href={detailHref}
          className="inline-flex h-8 items-center rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink hover:bg-line-2"
        >
          Open case
        </Link>
        {canActOnOwnership &&
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
        {canActOnOwnership && canManage && (
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
              placeholder="e.g. Auth renewal — stage stays Active"
            />
          </label>
          <button
            type="button"
            disabled={pending || !handoffReason.trim()}
            onClick={() => setConfirmHandoff(true)}
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
      <ConfirmDestructiveDialog
        open={confirmHandoff}
        onOpenChange={setConfirmHandoff}
        title="Hand off this family?"
        description={`Move ownership of ${row.firstName} ${row.lastName} (${row.clientCode}) from ${OWNER_DEPT_LABELS[dept]} to ${OWNER_DEPT_LABELS[handoffDept]}.\n\nReason: ${handoffReason.trim()}\n\nStage does not change. Claim history is kept; the receiving department sees this client in their unclaimed pool.`}
        confirmLabel="Confirm hand-off"
        pending={pending}
        onConfirm={() => {
          run(async () => {
            const res = await reassignOwnerDept(row.id, handoffDept, handoffReason)
            if (res.ok) {
              setShowHandoff(false)
              setConfirmHandoff(false)
              setHandoffReason('')
            }
            return res
          })
        }}
      />
    </li>
  )
}

function AssignedPile({
  title,
  rows,
  dept,
  canManage,
  viewerUserId,
  empty,
}: {
  title: string
  rows: DepartmentQueueRow[]
  dept: ClientOwnerDept
  canManage: boolean
  viewerUserId: string
  empty: string
}) {
  return (
    <section>
      <h2 className="mb-2 font-display text-base font-semibold text-ink">
        {title} ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-quiet">
          {empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <CaseCard
              key={row.id}
              row={row}
              dept={row.currentOwnerDept ?? dept}
              canManage={canManage}
              viewerUserId={viewerUserId}
              mode="mine"
            />
          ))}
        </ul>
      )}
    </section>
  )
}

export default function DepartmentQueueClient({
  data,
}: {
  data: DepartmentQueueData
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const isCc = data.slug === 'case-coordination'
  const [ccTab, setCcTab] = useState<'ready' | 'upcoming'>('ready')

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

  const billingBuckets = useMemo(() => {
    if (data.slug !== 'billing' && data.slug !== 'authorization') return null
    const order = [
      'Needs VOB',
      'VOB done / needs PA',
      'PA submitted / waiting',
      'PA approved',
      'Denied/problem',
    ] as const
    const map = new Map<string, DepartmentQueueRow[]>()
    for (const key of order) map.set(key, [])
    for (const row of data.claimed) {
      const key = row.billingSubstep ?? 'Needs VOB'
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    }
    return order.map((key) => ({ key, rows: map.get(key) ?? [] }))
  }, [data.slug, data.claimed])

  const ccCounts = useMemo(() => {
    if (!isCc) return { ready: 0, upcoming: 0 }
    if (data.canAssignCc && data.coordinatorGroups) {
      return data.coordinatorGroups.reduce(
        (acc, group) => {
          acc.ready += group.ready.length
          acc.upcoming += group.upcoming.length
          return acc
        },
        { ready: 0, upcoming: 0 }
      )
    }
    return {
      ready: data.ready?.length ?? 0,
      upcoming: data.upcoming?.length ?? 0,
    }
  }, [isCc, data.canAssignCc, data.coordinatorGroups, data.ready, data.upcoming])

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error ?? 'Failed')
      else router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          {data.label} queue
        </h1>
        <p className="mt-0.5 text-sm text-quiet">
          {isCc
            ? 'Case coordinators are assigned by a manager. Upcoming is before therapist found; Ready starts at RBT assigned.'
            : 'Claim a name from the pool to open the profile. You only see cases you have claimed.'}
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
          {error}
        </p>
      )}

      {isCc ? (
        <>
          {data.canAssignCc && data.unassignedCc && (
            <section>
              <h2 className="mb-2 font-display text-base font-semibold text-ink">
                Unassigned ({data.unassignedCc.length})
              </h2>
              <p className="mb-2 text-xs text-quiet">
                Name and stage only. Assign a case coordinator — they cannot self-claim.
              </p>
              {data.unassignedCc.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-quiet">
                  No unassigned coordination cases.
                </p>
              ) : (
                <ul className="space-y-3">
                  {data.unassignedCc.map((row) => (
                    <PoolCard
                      key={row.id}
                      row={row}
                      pending={pending}
                      assignOptions={data.caseCoordinators ?? []}
                      onAssign={(userId) =>
                        run(() => assignCaseCoordinator(row.id, userId))
                      }
                    />
                  ))}
                </ul>
              )}
            </section>
          )}

          <div className="rounded-xl border border-line bg-surface p-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCcTab('ready')}
                className={cn(
                  'h-9 rounded-lg border px-3 text-sm font-semibold transition',
                  ccTab === 'ready'
                    ? 'border-[var(--sunrise)] bg-[var(--sunrise)] text-[var(--espresso)]'
                    : 'border-line bg-surface text-ink hover:bg-line-2'
                )}
              >
                Ready Clients ({ccCounts.ready})
              </button>
              <button
                type="button"
                onClick={() => setCcTab('upcoming')}
                className={cn(
                  'h-9 rounded-lg border px-3 text-sm font-semibold transition',
                  ccTab === 'upcoming'
                    ? 'border-[var(--sunrise)] bg-[var(--sunrise)] text-[var(--espresso)]'
                    : 'border-line bg-surface text-ink hover:bg-line-2'
                )}
              >
                Upcoming Clients ({ccCounts.upcoming})
              </button>
            </div>
          </div>

          {data.canAssignCc && data.coordinatorGroups ? (
            data.coordinatorGroups.map((group) => (
              <div key={group.userId} className="space-y-4">
                <h2 className="font-display text-lg font-semibold text-ink">
                  {group.name}
                </h2>
                {ccTab === 'upcoming' ? (
                  <AssignedPile
                    title="Upcoming"
                    rows={group.upcoming}
                    dept={data.dept}
                    canManage={data.canManage}
                    viewerUserId={data.viewerUserId}
                    empty="No assigned clients before RBT assigned."
                  />
                ) : (
                  <AssignedPile
                    title="Ready"
                    rows={group.ready}
                    dept={data.dept}
                    canManage={data.canManage}
                    viewerUserId={data.viewerUserId}
                    empty="No assigned clients at RBT assigned or later."
                  />
                )}
              </div>
            ))
          ) : (
            <AssignedPile
              title={ccTab === 'upcoming' ? 'Upcoming' : 'Ready'}
              rows={ccTab === 'upcoming' ? (data.upcoming ?? []) : (data.ready ?? [])}
              dept={data.dept}
              canManage={data.canManage}
              viewerUserId={data.viewerUserId}
              empty={
                ccTab === 'upcoming'
                  ? 'No assigned clients before RBT assigned.'
                  : 'No assigned clients at RBT assigned or later.'
              }
            />
          )}
        </>
      ) : (
        <>
          <section>
            <h2 className="mb-2 font-display text-base font-semibold text-ink">
              Unclaimed ({data.unclaimed.length})
            </h2>
            <p className="mb-2 text-xs text-quiet">
              Name and current stage only. Claim to open the profile.
            </p>
            {data.unclaimed.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-quiet">
                No unclaimed cases in this department.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.unclaimed.map((row) => (
                  <PoolCard
                    key={row.id}
                    row={row}
                    pending={pending}
                    onClaim={() => run(() => claimClient(row.id))}
                  />
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 font-display text-base font-semibold text-ink">
              My claimed work ({data.claimed.length})
            </h2>
            {data.claimed.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-quiet">
                No claimed cases in this department. Claim from the pool to start work.
              </p>
            ) : (
              <div className="space-y-4">
                {billingBuckets?.map((bucket) => (
                  <div key={bucket.key}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-quiet">
                      {bucket.key} ({bucket.rows.length})
                    </h3>
                    <ul className="space-y-3">
                      {bucket.rows.map((row) => (
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
                {!billingBuckets &&
                  claimedByOwner.map(([owner, rows]) => (
                  <div key={owner}>
                    {data.canManage && (
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-quiet">
                        {owner}
                      </h3>
                    )}
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
    </div>
  )
}
