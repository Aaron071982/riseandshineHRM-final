'use client'

import { useMemo } from 'react'
import type { ClientStage } from '@prisma/client'
import {
  DAYS,
  DAY_FULL,
  minToLabel,
  hoursOf,
  fmtH,
  type Day,
} from '@/lib/schedule/utils'
import type {
  ScheduleTherapist,
  ScheduleClient,
  ScheduleSlot,
  RowDimension,
} from '@/lib/schedule/types'
import {
  CLIENT_STAGE_ORDER,
  STAGE_LABELS,
} from '@/lib/crm/stages'
import { cn } from '@/lib/utils'

type Props = {
  therapists: ScheduleTherapist[]
  clients: ScheduleClient[]
  slots: ScheduleSlot[]
  rowDim?: RowDimension
  showAllRows?: boolean
  onEditSlot: (slot: ScheduleSlot) => void
  onAddSlot: (opts: { therapistId?: string; clientId?: string; day: Day }) => void
}

type RowEntity = ScheduleTherapist | ScheduleClient

const STAGE_SECTION_ORDER: ClientStage[] = [...CLIENT_STAGE_ORDER]

function weeklyHoursForRow(
  rowId: string,
  slots: ScheduleSlot[],
  isTherapistRows: boolean
): number {
  const key = isTherapistRows ? 'therapistId' : 'clientId'
  return slots
    .filter((s) => s[key] === rowId && s.status !== 'CANCELLED')
    .reduce((a, s) => a + hoursOf(s), 0)
}

function RosterTable({
  title,
  subtitle,
  rows,
  isTherapistRows,
  slots,
  therapistById,
  clientById,
  byRowDay,
  onEditSlot,
  onAddSlot,
}: {
  title?: string
  subtitle?: string
  rows: RowEntity[]
  isTherapistRows: boolean
  slots: ScheduleSlot[]
  therapistById: Map<string, ScheduleTherapist>
  clientById: Map<string, ScheduleClient>
  byRowDay: Map<string, ScheduleSlot[]>
  onEditSlot: (slot: ScheduleSlot) => void
  onAddSlot: (opts: { therapistId?: string; clientId?: string; day: Day }) => void
}) {
  const headCell =
    'sticky top-0 z-20 border border-line bg-[var(--espresso)] px-3 py-2.5 font-display text-xs font-semibold uppercase tracking-wide text-white'
  const bodyCell =
    'border border-line align-top bg-surface px-2 py-2 min-h-[44px]'

  const cellLine = (s: ScheduleSlot) => {
    if (isTherapistRows) {
      const c = clientById.get(s.clientId)
      return `${c?.name ?? '—'} · ${minToLabel(s.startMin)}–${minToLabel(s.endMin)}`
    }
    const t = therapistById.get(s.therapistId)
    return `${t?.name ?? '—'} · ${minToLabel(s.startMin)}–${minToLabel(s.endMin)}`
  }

  const handleAdd = (rowId: string, day: Day) => {
    if (isTherapistRows) onAddSlot({ therapistId: rowId, day })
    else onAddSlot({ clientId: rowId, day })
  }

  if (rows.length === 0) return null

  return (
    <section className="space-y-2">
      {title && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
          <h3 className="font-display text-sm font-semibold text-ink">{title}</h3>
          {subtitle && <p className="text-xs text-quiet">{subtitle}</p>}
        </div>
      )}
      <div className="overflow-auto rounded-xl border border-line bg-surface shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th
                className={`${headCell} sticky left-0 z-30 min-w-[200px] text-left`}
              >
                {isTherapistRows ? 'RBT (Therapist)' : 'Client'}
              </th>
              {DAYS.map((d) => (
                <th key={d} className={`${headCell} min-w-[150px] text-center`}>
                  {DAY_FULL[d]}
                </th>
              ))}
              <th
                className={`${headCell} sticky right-0 z-30 min-w-[84px] text-center`}
              >
                Hrs / wk
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const hrs = weeklyHoursForRow(row.id, slots, isTherapistRows)
              const client = !isTherapistRows
                ? clientById.get(row.id)
                : undefined
              return (
                <tr key={row.id} className="hover:bg-line-2/60 transition-colors">
                  <td
                    className={`${bodyCell} sticky left-0 z-10 border-r border-line font-medium text-ink`}
                  >
                    <div>{row.name}</div>
                    {!isTherapistRows && client?.code && (
                      <div className="text-xs font-normal text-quiet">{client.code}</div>
                    )}
                  </td>
                  {DAYS.map((d) => {
                    const cell = byRowDay.get(`${row.id}|${d}`) ?? []
                    return (
                      <td
                        key={d}
                        className={`${bodyCell} group cursor-pointer`}
                        onClick={() => cell.length === 0 && handleAdd(row.id, d)}
                      >
                        {cell.length === 0 ? (
                          <span className="flex min-h-[28px] items-center justify-center text-xs text-faint opacity-0 transition group-hover:opacity-100">
                            + Add
                          </span>
                        ) : (
                          <div className="space-y-1">
                            {cell.map((s) => {
                              const flagged = s.status === 'NEEDS_REVIEW'
                              const line = cellLine(s)
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onEditSlot(s)
                                  }}
                                  className={cn(
                                    'block w-full rounded px-1 py-0.5 text-left text-xs leading-snug text-ink hover:bg-[var(--sunrise-soft)] hover:text-brand whitespace-normal',
                                    flagged && 'border-l-2 border-[var(--amber)] pl-1.5'
                                  )}
                                  title={line}
                                >
                                  {line}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </td>
                    )
                  })}
                  <td
                    className={cn(
                      `${bodyCell} sticky right-0 z-10 border-l border-line text-center font-semibold tabular-nums`,
                      hrs > 0 ? 'text-[var(--green)]' : 'text-[var(--amber)]'
                    )}
                  >
                    {fmtH(hrs)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function RosterView({
  therapists,
  clients,
  slots,
  rowDim = 'therapist',
  showAllRows = false,
  onEditSlot,
  onAddSlot,
}: Props) {
  const isTherapistRows = rowDim === 'therapist'

  const therapistRows = useMemo(() => {
    const list = showAllRows ? therapists : therapists.filter((t) => t.active)
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [therapists, showAllRows])

  const clientRows = useMemo(() => {
    return [...clients].sort((a, b) => a.name.localeCompare(b.name))
  }, [clients])

  const therapistById = useMemo(
    () => new Map(therapists.map((t) => [t.id, t])),
    [therapists]
  )

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])

  const byRowDay = useMemo(() => {
    const m = new Map<string, ScheduleSlot[]>()
    for (const s of slots) {
      if (s.status === 'CANCELLED') continue
      const rowId = isTherapistRows ? s.therapistId : s.clientId
      const k = `${rowId}|${s.day}`
      const arr = m.get(k)
      if (arr) arr.push(s)
      else m.set(k, [s])
    }
    for (const arr of m.values()) arr.sort((a, b) => a.startMin - b.startMin)
    return m
  }, [slots, isTherapistRows])

  const clientStageSections = useMemo(() => {
    const byStage = new Map<ClientStage | 'UNLINKED', ScheduleClient[]>()
    for (const client of clientRows) {
      const key = client.stage ?? 'UNLINKED'
      const bucket = byStage.get(key)
      if (bucket) bucket.push(client)
      else byStage.set(key, [client])
    }

    const sections: { title: string; rows: ScheduleClient[] }[] = []

    for (const stage of STAGE_SECTION_ORDER) {
      const rows = byStage.get(stage)
      if (!rows?.length) continue
      sections.push({
        title: `${STAGE_LABELS[stage]} (${rows.length})`,
        rows: [...rows].sort((a, b) => a.name.localeCompare(b.name)),
      })
    }

    const unlinked = byStage.get('UNLINKED')
    if (unlinked?.length) {
      sections.push({
        title: `Unlinked schedule names (${unlinked.length})`,
        rows: [...unlinked].sort((a, b) => a.name.localeCompare(b.name)),
      })
    }

    return sections
  }, [clientRows])

  const tableProps = {
    isTherapistRows,
    slots,
    therapistById,
    clientById,
    byRowDay,
    onEditSlot,
    onAddSlot,
  }

  return (
    <>
      <div className="hidden space-y-6 md:block">
        {isTherapistRows ? (
          <RosterTable rows={therapistRows} {...tableProps} />
        ) : clientStageSections.length > 0 ? (
          clientStageSections.map((section) => (
            <RosterTable
              key={section.title}
              title={section.title}
              rows={section.rows}
              {...tableProps}
            />
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-line px-4 py-12 text-center text-sm text-quiet">
            No clients in this view — enable Show inactive or add a session.
          </p>
        )}

        {isTherapistRows && therapistRows.length === 0 && (
          <p className="rounded-xl border border-dashed border-line px-4 py-12 text-center text-sm text-quiet">
            No therapists in this view — add a session or enable Show inactive.
          </p>
        )}
      </div>

      {/* Mobile: per-day accordion */}
      <div className="space-y-3 md:hidden">
        {DAYS.map((day) => {
          const daySlots = slots.filter((s) => s.day === day && s.status !== 'CANCELLED')
          if (daySlots.length === 0) return null
          return (
            <details
              key={day}
              className="rounded-xl border border-line bg-surface p-3"
              open
            >
              <summary className="cursor-pointer font-display text-sm font-semibold text-ink">
                {DAY_FULL[day]} ({daySlots.length})
              </summary>
              <ul className="mt-2 space-y-2">
                {daySlots.map((slot) => {
                  const tn = therapistById.get(slot.therapistId)?.name ?? '—'
                  const cn = clientById.get(slot.clientId)?.name ?? '—'
                  return (
                    <li key={slot.id}>
                      <button
                        type="button"
                        className="w-full rounded-lg border border-line bg-line-2/40 p-2.5 text-left text-sm hover:bg-line-2"
                        onClick={() => onEditSlot(slot)}
                      >
                        <span className="font-medium text-ink">{tn}</span>
                        <span className="text-quiet"> → {cn} </span>
                        <span className="text-xs tabular-nums text-quiet">
                          {minToLabel(slot.startMin)}–{minToLabel(slot.endMin)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </details>
          )
        })}
      </div>
    </>
  )
}
