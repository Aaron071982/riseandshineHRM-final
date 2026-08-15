'use client'

import { useCallback, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { AssignmentStage, ServiceBtAssignmentStatus } from '@prisma/client'
import {
  assignBcba,
  assignRbt,
  flagRbtReplacement,
  removeRbtAssignment,
  searchBcbaProfiles,
  searchRbtProfiles,
  updateRbtAssignment,
} from '@/lib/crm/actions'
import { ProfilePicker } from '@/components/crm/ProfilePicker'
import { cn } from '@/lib/utils'

type RbtProfile = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  status: string
}

type Assignment = {
  id: string
  btName: string
  rbtProfileId: string | null
  assignmentStage: AssignmentStage
  isPrimary: boolean
  status: ServiceBtAssignmentStatus
  rbtProfile: RbtProfile | null
}

type Bcba = { id: string; fullName: string; email: string | null } | null

const STAGES: AssignmentStage[] = [
  'SEARCHING',
  'CONTACTED',
  'INTERESTED',
  'MATCH_PENDING',
  'ASSIGNED',
]

export function StaffingPanel({
  clientId,
  assignments,
  bcbaProfile,
  bcbaProfileId,
  canEdit,
}: {
  clientId: string
  assignments: Assignment[]
  bcbaProfile: Bcba
  bcbaProfileId: string | null
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [pickedRbt, setPickedRbt] = useState<{ id: string; name: string } | null>(
    null
  )
  const [pickedBcba, setPickedBcba] = useState<{
    id: string
    name: string
  } | null>(
    bcbaProfile
      ? { id: bcbaProfile.id, name: bcbaProfile.fullName }
      : null
  )

  const searchRbt = useCallback(async (q: string) => {
    const res = await searchRbtProfiles(q)
    if (!res.ok) return { ok: false as const, error: res.error }
    return { ok: true as const, results: res.results }
  }, [])

  const searchBcba = useCallback(async (q: string) => {
    const res = await searchBcbaProfiles(q)
    if (!res.ok) return { ok: false as const, error: res.error }
    return { ok: true as const, results: res.results }
  }, [])

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
          {error}
        </p>
      )}

      {/* BCBA */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <h3 className="font-display text-base font-semibold text-ink">BCBA</h3>
        <p className="mt-0.5 text-sm text-quiet">
          Linked via profile FK — drives the schedule-confirmed gate.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canEdit ? (
            <>
              <ProfilePicker
                mode="bcba"
                valueId={pickedBcba?.id ?? bcbaProfileId}
                valueLabel={pickedBcba?.name ?? bcbaProfile?.fullName ?? null}
                searchFn={searchBcba}
                placeholder="Search BCBA profiles…"
                disabled={pending}
                onSelect={(id, name) => {
                  setPickedBcba(id && name ? { id, name } : null)
                }}
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    setError('')
                    const res = await assignBcba(
                      clientId,
                      pickedBcba?.id ?? null
                    )
                    if (!res.ok) setError(res.error)
                    router.refresh()
                  })
                }}
                className="h-9 rounded-lg bg-brand px-3 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-50"
              >
                Save BCBA
              </button>
            </>
          ) : (
            <p className="text-sm text-ink">
              {bcbaProfile?.fullName || 'Unassigned'}
            </p>
          )}
        </div>
      </section>

      {/* RBT assignments */}
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold text-ink">
              RBT assignments
            </h3>
            <p className="text-sm text-quiet">
              Assignments write a real rbtProfileId — names link to RBT profiles.
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3">
            <ProfilePicker
              mode="rbt"
              valueId={pickedRbt?.id ?? null}
              valueLabel={pickedRbt?.name ?? null}
              searchFn={searchRbt}
              placeholder="Search RBT profiles…"
              disabled={pending}
              onSelect={(id, name) =>
                setPickedRbt(id && name ? { id, name } : null)
              }
            />
            <button
              type="button"
              disabled={pending || !pickedRbt}
              onClick={() => {
                if (!pickedRbt) return
                startTransition(async () => {
                  setError('')
                  const res = await assignRbt(clientId, {
                    rbtProfileId: pickedRbt.id,
                    isPrimary: assignments.every((a) => !a.isPrimary),
                    assignmentStage: 'ASSIGNED',
                  })
                  if (!res.ok) setError(res.error)
                  else setPickedRbt(null)
                  router.refresh()
                })
              }}
              className="h-9 rounded-lg bg-brand px-3 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-50"
            >
              Assign RBT
            </button>
          </div>
        )}

        {assignments.length === 0 && (
          <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-quiet">
            No RBTs assigned yet — search and assign a profile to staff this client.
          </div>
        )}

        <ul className="space-y-2">
          {assignments.map((a) => {
            const name =
              a.rbtProfile
                ? `${a.rbtProfile.firstName} ${a.rbtProfile.lastName}`.trim()
                : a.btName
            return (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  {a.rbtProfileId ? (
                    <Link
                      href={`/admin/rbts/${a.rbtProfileId}`}
                      className="text-sm font-medium text-brand hover:text-brand-2"
                    >
                      {name}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-ink">{name}</span>
                  )}
                  <div className="text-xs text-quiet">
                    {a.isPrimary ? 'Primary · ' : ''}
                    {a.status}
                    {!a.rbtProfileId && ' · legacy name-only (re-assign to link)'}
                  </div>
                </div>
                {canEdit ? (
                  <select
                    disabled={pending}
                    value={a.assignmentStage}
                    onChange={(e) => {
                      const assignmentStage = e.target.value as AssignmentStage
                      startTransition(async () => {
                        await updateRbtAssignment(a.id, { assignmentStage })
                        router.refresh()
                      })
                    }}
                    className="h-8 rounded-lg border border-line bg-surface px-2 text-xs focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="rounded-md bg-line-2 px-2 py-0.5 text-[11px] text-quiet">
                    {a.assignmentStage.replace(/_/g, ' ')}
                  </span>
                )}
                {canEdit && (
                  <>
                    <button
                      type="button"
                      disabled={pending || a.isPrimary}
                      onClick={() => {
                        startTransition(async () => {
                          await updateRbtAssignment(a.id, { isPrimary: true })
                          router.refresh()
                        })
                      }}
                      className={cn(
                        'text-xs',
                        a.isPrimary ? 'text-brand' : 'text-quiet hover:text-ink'
                      )}
                    >
                      {a.isPrimary ? 'Primary' : 'Make primary'}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          setError('')
                          const res = await flagRbtReplacement(clientId, {
                            btName: name,
                            reason: `Replacement needed for ${name}`,
                          })
                          if (!res.ok) setError(res.error)
                          router.refresh()
                        })
                      }}
                      className="text-xs text-[var(--amber)] hover:underline"
                    >
                      Flag replacement
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          await removeRbtAssignment(a.id)
                          router.refresh()
                        })
                      }}
                      className="text-xs text-[var(--urgent)] hover:underline"
                    >
                      Remove
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
