'use client'

import { memo } from 'react'
import Link from 'next/link'
import { Handle, Position, type NodeProps } from 'reactflow'
import { ArrowRight, ShieldCheck, Users } from 'lucide-react'
import {
  CRM_ROLE_LABELS,
  type ProcessPerson,
} from '@/lib/crm/processMapModel'
import { cn } from '@/lib/utils'
import type {
  DeptNodeData,
  LeadershipNodeData,
  TrackNodeData,
} from './buildProcessGraph'
import { DEPT_NODE_W } from './buildProcessGraph'

const NO_MEMBERS_HINT = 'No members yet — assign in Admin Management'

function initial(label: string): string {
  const trimmed = label.trim()
  return trimmed ? trimmed[0]!.toUpperCase() : '?'
}

function PeopleChips({
  people,
  accent,
  showRoles = false,
}: {
  people: ProcessPerson[]
  accent: string
  showRoles?: boolean
}) {
  if (people.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-[var(--bg)] px-2.5 py-2 text-[11px] leading-snug text-faint">
        {NO_MEMBERS_HINT}
      </p>
    )
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {people.map((person) => (
        <li
          key={person.id}
          className="flex items-center gap-1.5 rounded-pill border border-line bg-surface px-2 py-1 text-[11px] font-medium text-ink"
          title={
            showRoles
              ? person.roles.map((r) => CRM_ROLE_LABELS[r]).join(' · ')
              : undefined
          }
        >
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ backgroundColor: accent }}
          >
            {initial(person.label)}
          </span>
          <span className="max-w-[150px] truncate">{person.label}</span>
        </li>
      ))}
    </ul>
  )
}

function ProcessDeptNodeInner({ data }: NodeProps<DeptNodeData>) {
  const { department, step } = data
  const { accent, counts } = department

  const body = (
    <>
      <div
        className="flex items-center justify-between gap-2 rounded-t-card px-3 py-2"
        style={{ backgroundColor: accent.bg }}
      >
        <div className="flex items-center gap-2">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: accent.fg }}
          >
            {step}
          </span>
          <span
            className="font-display text-sm font-semibold"
            style={{ color: accent.fg }}
          >
            {department.label}
          </span>
        </div>
        {department.canOpen && (
          <ArrowRight className="h-3.5 w-3.5" style={{ color: accent.fg }} />
        )}
      </div>

      <div className="space-y-2.5 px-3 py-3">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {department.scopeLimited && counts.total === 0 ? (
            <span
              className="rounded-pill bg-[var(--bg)] px-2 py-0.5 text-faint"
              title="You don't hold this department's role, so its cases aren't in your scope."
            >
              No cases in your scope
            </span>
          ) : (
            <>
              <span className="rounded-pill bg-[var(--bg)] px-2 py-0.5 font-semibold text-ink">
                {counts.total} {counts.total === 1 ? 'case' : 'cases'}
              </span>
              <span
                className={cn(
                  'rounded-pill px-2 py-0.5 font-medium',
                  counts.unclaimed > 0
                    ? 'bg-[var(--amber-bg)] text-[var(--amber)]'
                    : 'bg-[var(--bg)] text-quiet'
                )}
              >
                {counts.unclaimed} unclaimed
              </span>
              <span className="rounded-pill bg-[var(--bg)] px-2 py-0.5 font-medium text-quiet">
                {counts.claimed} claimed
              </span>
              {department.scopeLimited && (
                <span
                  className="rounded-pill bg-[var(--bg)] px-2 py-0.5 text-faint"
                  title="You don't hold this department's role — counts show only cases in your scope."
                >
                  your scope
                </span>
              )}
            </>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
            Stages owned
          </p>
          {department.stages.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-[var(--bg)] px-2.5 py-2 text-[11px] leading-snug text-faint">
              No pipeline stage — picks up after services are active.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {department.stages.map((s) => (
                <li key={s.stage} className="rounded-lg bg-[var(--bg)] px-2.5 py-1.5">
                  <p className="text-[11px] font-semibold text-ink">{s.label}</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-quiet">
                    {s.description}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-faint">
            <Users className="h-3 w-3" />
            People
          </p>
          <PeopleChips people={department.people} accent={accent.fg} />
        </div>
      </div>
    </>
  )

  return (
    <div
      className="rounded-card border border-line bg-surface shadow-sm transition-shadow hover:shadow-md"
      style={{ width: DEPT_NODE_W, borderTopColor: accent.fg, borderTopWidth: 3 }}
    >
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        isConnectable={false}
        className="!h-1.5 !w-1.5 !border-0 !bg-[var(--line)]"
      />
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="!h-2 !w-2 !border-0"
        style={{ backgroundColor: accent.fg }}
      />
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!h-2 !w-2 !border-0"
        style={{ backgroundColor: accent.fg }}
      />
      <Handle
        id="up"
        type="target"
        position={Position.Bottom}
        isConnectable={false}
        className="!h-1.5 !w-1.5 !border-0 !bg-[var(--faint)]"
        style={{ left: '35%' }}
      />
      <Handle
        id="down"
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        className="!h-1.5 !w-1.5 !border-0 !bg-[var(--faint)]"
        style={{ left: '65%' }}
      />

      {department.canOpen ? (
        <Link
          href={department.href}
          className="nodrag block rounded-card focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          title={`Open the ${department.label} queue`}
        >
          {body}
        </Link>
      ) : (
        <div title={`${department.label} queue — requires the department role`}>
          {body}
        </div>
      )}
    </div>
  )
}

function ProcessLeadershipNodeInner({ data }: NodeProps<LeadershipNodeData>) {
  return (
    <div className="w-[460px] rounded-card border border-line bg-surface shadow-sm">
      <div className="flex items-center gap-2 rounded-t-card bg-[var(--bg)] px-3 py-2">
        <ShieldCheck className="h-4 w-4 text-[var(--brand)]" />
        <span className="font-display text-sm font-semibold text-ink">
          Leadership / sees all
        </span>
        <span className="ml-auto text-[10px] text-faint">
          Super admin · Management
        </span>
      </div>
      <div className="space-y-2 px-3 py-3">
        <p className="text-[11px] leading-snug text-quiet">
          Full access to every department queue — no hand-off needed. Escalate
          here when a case is stuck between departments.
        </p>
        <PeopleChips people={data.people} accent="var(--brand)" showRoles />
      </div>
      <Handle
        id="oversight"
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        className="!h-1.5 !w-1.5 !border-0 !bg-[var(--line)]"
      />
    </div>
  )
}

function ProcessTrackNodeInner({ data }: NodeProps<TrackNodeData>) {
  return (
    <div
      className="rounded-card border border-dashed bg-surface shadow-sm"
      style={{ width: DEPT_NODE_W, borderColor: 'var(--stage-clinical)' }}
    >
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        isConnectable={false}
        className="!h-1.5 !w-1.5 !border-0"
        style={{ backgroundColor: 'var(--stage-clinical)' }}
      />
      <div
        className="rounded-t-card px-3 py-2"
        style={{ backgroundColor: 'var(--stage-clinical-bg)' }}
      >
        <p
          className="font-display text-sm font-semibold"
          style={{ color: 'var(--stage-clinical)' }}
        >
          Parallel track — {data.track.label}
        </p>
      </div>
      <div className="space-y-1.5 px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
          Owned by {data.ownerLabel}
        </p>
        <p className="text-[11px] leading-snug text-quiet">
          {data.track.description}
        </p>
      </div>
    </div>
  )
}

export const ProcessDeptNode = memo(ProcessDeptNodeInner)
export const ProcessLeadershipNode = memo(ProcessLeadershipNodeInner)
export const ProcessTrackNode = memo(ProcessTrackNodeInner)
