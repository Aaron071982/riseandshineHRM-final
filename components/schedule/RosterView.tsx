'use client'

import { useMemo } from 'react'
import {
  DAYS,
  DAY_FULL,
  THERAPIST_PALETTE,
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

type Props = {
  therapists: ScheduleTherapist[]
  clients: ScheduleClient[]
  slots: ScheduleSlot[]
  rowDim?: RowDimension
  onEditSlot: (slot: ScheduleSlot) => void
  onAddSlot: (opts: { therapistId?: string; clientId?: string; day: Day }) => void
}

function softForIndex(colorKey: number | null, i: number) {
  const idx =
    ((colorKey ?? i) % THERAPIST_PALETTE.length + THERAPIST_PALETTE.length) %
    THERAPIST_PALETTE.length
  return THERAPIST_PALETTE[idx].soft
}

export default function RosterView({
  therapists,
  clients,
  slots,
  rowDim = 'therapist',
  onEditSlot,
  onAddSlot,
}: Props) {
  const isTherapistRows = rowDim === 'therapist'

  const therapistRows = useMemo(
    () => therapists.filter((t) => t.active).sort((a, b) => a.name.localeCompare(b.name)),
    [therapists]
  )

  const clientRows = useMemo(
    () => clients.filter((c) => c.active).sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  )

  const rows = isTherapistRows ? therapistRows : clientRows

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

  const weeklyHours = (rowId: string) => {
    const key = isTherapistRows ? 'therapistId' : 'clientId'
    return slots
      .filter((s) => s[key] === rowId && s.status !== 'CANCELLED')
      .reduce((a, s) => a + hoursOf(s), 0)
  }

  const headCell =
    'sticky top-0 bg-[#0E4D52] text-white font-semibold px-3 py-2 text-[13px]'
  const bodyCell = 'border border-[#EEF1F1] align-top px-2 py-2 min-h-[44px]'

  const rowLabel = (row: ScheduleTherapist | ScheduleClient) => row.name

  const cellLine = (s: ScheduleSlot) => {
    if (isTherapistRows) {
      const c = clientById.get(s.clientId)
      return `${c?.name ?? '—'} · ${minToLabel(s.startMin)}–${minToLabel(s.endMin)}`
    }
    const t = therapistById.get(s.therapistId)
    return `${t?.name ?? '—'} · ${minToLabel(s.startMin)}–${minToLabel(s.endMin)}`
  }

  const softForRow = (row: ScheduleTherapist | ScheduleClient, i: number) => {
    if (isTherapistRows) {
      return softForIndex((row as ScheduleTherapist).colorKey, i)
    }
    return softForIndex(null, i)
  }

  const handleAdd = (rowId: string, day: Day) => {
    if (isTherapistRows) onAddSlot({ therapistId: rowId, day })
    else onAddSlot({ clientId: rowId, day })
  }

  return (
    <>
      {/* Desktop matrix */}
      <div className="hidden md:block overflow-auto rounded-xl border border-[#E4E8E9] bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th
                className={`${headCell} sticky left-0 z-30 text-left min-w-[200px]`}
              >
                {isTherapistRows ? 'RBT (Therapist)' : 'Client'}
              </th>
              {DAYS.map((d) => (
                <th key={d} className={`${headCell} z-20 text-center min-w-[150px]`}>
                  {DAY_FULL[d]}
                </th>
              ))}
              <th className={`${headCell} sticky right-0 z-30 text-center min-w-[84px]`}>
                Hrs / wk
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const soft = softForRow(row, i)
              return (
                <tr key={row.id}>
                  <td
                    className={`${bodyCell} sticky left-0 z-10 font-semibold text-[#16232A]`}
                    style={{ background: soft }}
                  >
                    {rowLabel(row)}
                  </td>

                  {DAYS.map((d) => {
                    const cell = byRowDay.get(`${row.id}|${d}`) ?? []
                    return (
                      <td
                        key={d}
                        className={`${bodyCell} group cursor-pointer`}
                        style={{ background: soft }}
                        onClick={() => cell.length === 0 && handleAdd(row.id, d)}
                      >
                        {cell.length === 0 ? (
                          <span className="flex min-h-[28px] items-center justify-center text-[12px] text-[#6b7b80] opacity-0 transition group-hover:opacity-70">
                            + Add
                          </span>
                        ) : (
                          <div className="space-y-1.5">
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
                                  className={`block w-full text-left text-[13px] leading-snug text-[#1a2b30] hover:underline whitespace-normal ${
                                    flagged ? 'border-l-2 border-amber-400 pl-1.5' : ''
                                  }`}
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
                    className={`${bodyCell} sticky right-0 z-10 text-center font-bold tabular-nums`}
                    style={{ background: soft, color: '#9A6A17' }}
                  >
                    {fmtH(weeklyHours(row.id))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-center text-gray-500 py-12">No sessions yet — add the first one.</p>
        )}
      </div>

      {/* Mobile: per-day accordion */}
      <div className="md:hidden space-y-3">
        {DAYS.map((day) => {
          const daySlots = slots.filter((s) => s.day === day && s.status !== 'CANCELLED')
          if (daySlots.length === 0) return null
          return (
            <details key={day} className="bg-white rounded-lg border border-[#E4E8E9] p-3" open>
              <summary className="font-semibold cursor-pointer">
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
                        className="w-full text-left text-sm p-2 rounded bg-gray-50"
                        onClick={() => onEditSlot(slot)}
                      >
                        <span className="font-medium">{tn}</span> → {cn}{' '}
                        <span className="text-gray-500">
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
