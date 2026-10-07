'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRightLeft, ExternalLink, Loader2, Plus, X } from 'lucide-react'
import type { ScheduleSlot } from '@/lib/schedule/types'
import { DAYS, DAY_FULL, fmtH, type Day } from '@/lib/schedule/utils'
import {
  BAND_META,
  pairKey,
  slotsLabel,
  type ConstellationModel,
  type PairModel,
  type TherapistModel,
} from '@/lib/schedule/constellation'
import { setTherapistWeeklyTarget, type TherapistCapacityRow } from '@/lib/schedule/capacityActions'
import { useToast } from '@/components/ui/toast'
import CapacityMeter from './CapacityMeter'
import SessionInlineRow from './SessionInlineRow'

export type PanelSelection =
  | { kind: 'therapist'; id: string }
  | { kind: 'client'; id: string }
  | { kind: 'pair'; key: string }

type SlotHandlers = {
  allSlots: ScheduleSlot[]
  conflicts: Map<string, string[]>
  onSlotSaved: (slot: ScheduleSlot) => void
  onSlotDeleted: (id: string) => void
  onEditSlot: (slot: ScheduleSlot) => void
}

const rowKey = (s: ScheduleSlot) => `${s.id}:${s.day}:${s.startMin}:${s.endMin}`

function SlotList({
  slots,
  titleFor,
  handlers,
}: {
  slots: ScheduleSlot[]
  titleFor: (s: ScheduleSlot) => string
  handlers: SlotHandlers
}) {
  if (slots.length === 0) return <p className="text-[12px] text-[var(--muted-ink)]">No sessions this period.</p>
  return (
    <div className="space-y-1.5">
      {slots.map((s) => (
        <SessionInlineRow
          key={rowKey(s)}
          slot={s}
          title={titleFor(s)}
          allSlots={handlers.allSlots}
          conflictReasons={handlers.conflicts.get(s.id)}
          onSaved={handlers.onSlotSaved}
          onDeleted={handlers.onSlotDeleted}
          onOpenEditor={handlers.onEditSlot}
        />
      ))}
    </div>
  )
}

function TargetEditor({
  model,
  canEdit,
  onTargetSaved,
}: {
  model: TherapistModel
  canEdit: boolean
  onTargetSaved: (row: TherapistCapacityRow) => void
}) {
  const { showToast } = useToast()
  const [value, setValue] = useState(model.target.source === 'ADMIN' ? String(model.target.hours) : '')
  const [saving, setSaving] = useState(false)
  const sourceText =
    model.target.source === 'ADMIN'
      ? 'set by admin'
      : model.target.source === 'PREFERENCE'
        ? `from application preference (${model.target.preferredHoursRange})`
        : 'default'

  const save = async (hours: number | null) => {
    setSaving(true)
    try {
      const row = await setTherapistWeeklyTarget({ therapistId: model.therapist.id, hours })
      onTargetSaved(row)
      showToast(hours == null ? 'Target reset' : `Target set to ${fmtH(hours)} hrs`, 'success')
    } catch (e) {
      showToast(e instanceof Error && e.message === 'FORBIDDEN' ? 'Only admins can change targets' : 'Could not save target', 'error')
    } finally {
      setSaving(false)
    }
  }

  const parsed = Number(value)
  const valid = value.trim() !== '' && Number.isFinite(parsed) && parsed > 0 && parsed <= 80

  return (
    <div className="space-y-1.5">
      <p className="text-[12px] text-[var(--muted-ink)]">
        Weekly target <span className="font-semibold tabular-nums text-[var(--espresso)]">{fmtH(model.target.hours)} hrs</span> · {sourceText}
      </p>
      {canEdit && (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            max={80}
            step={0.5}
            placeholder="Set target hrs"
            aria-label="Weekly target hours"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-7 w-28 rounded-md border border-[var(--line)] px-2 text-[12px] tabular-nums"
          />
          <button
            type="button"
            disabled={!valid || saving}
            onClick={() => void save(parsed)}
            className="flex h-7 items-center gap-1 rounded-md bg-[var(--espresso)] px-2.5 text-[11.5px] font-medium text-white disabled:opacity-40"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            Save target
          </button>
          {model.target.source === 'ADMIN' && (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setValue('')
                void save(null)
              }}
              className="h-7 rounded-md px-2 text-[11.5px] text-[var(--muted-ink)] hover:bg-[var(--line-2)]"
            >
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function ConstellationPanel({
  selection,
  model,
  canEditTarget,
  moveTargets,
  onClose,
  onAddSession,
  onTargetSaved,
  onRequestMove,
  ...handlers
}: SlotHandlers & {
  selection: PanelSelection
  model: ConstellationModel
  canEditTarget: boolean
  /** Therapists offered in "Move to…" (id + name). */
  moveTargets: Array<{ id: string; name: string }>
  onClose: () => void
  onAddSession: (defaults: { therapistId?: string; clientId?: string }) => void
  onTargetSaved: (row: TherapistCapacityRow) => void
  onRequestMove: (opts: { clientId: string; fromTherapistId: string; toTherapistId: string }) => void
}) {
  const clientName = (id: string) => model.clients.get(id)?.client.name ?? 'Client'
  const therapistName = (id: string) => model.therapists.get(id)?.therapist.name ?? 'Therapist'

  let body: React.ReactNode = null
  let heading = ''

  if (selection.kind === 'therapist') {
    const tm = model.therapists.get(selection.id)
    if (!tm) return null
    heading = tm.therapist.name
    const slots = tm.pairKeys.flatMap((k) => model.pairs.get(k)?.slots ?? [])
    body = (
      <>
        <section className="space-y-2">
          <CapacityMeter hours={tm.hours} target={tm.target.hours} size="lg" />
          <p className="text-[12px] font-medium" style={{ color: BAND_META[tm.band].color }}>
            {BAND_META[tm.band].symbol} {BAND_META[tm.band].label}
          </p>
          <TargetEditor key={`${tm.therapist.id}:${tm.target.hours}:${tm.target.source}`} model={tm} canEdit={canEditTarget} onTargetSaved={onTargetSaved} />
        </section>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAddSession({ therapistId: tm.therapist.id })}
            className="flex h-8 items-center gap-1 rounded-lg bg-[var(--brand)] px-3 text-[12.5px] font-medium text-white hover:bg-[var(--brand-2)]"
          >
            <Plus className="h-3.5 w-3.5" /> Add session
          </button>
          <Link
            href={`/admin/rbts/${tm.therapist.id}`}
            target="_blank"
            className="flex items-center gap-1 text-[12px] text-[var(--muted-ink)] hover:text-[var(--brand)]"
          >
            Profile <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        <section className="space-y-3">
          {DAYS.map((d) => {
            const daySlots = slots.filter((s) => s.day === d).sort((a, b) => a.startMin - b.startMin)
            if (!daySlots.length) return null
            return (
              <div key={d} className="space-y-1.5">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-ink)]">{DAY_FULL[d as Day]}</h4>
                <SlotList slots={daySlots} titleFor={(s) => clientName(s.clientId)} handlers={handlers} />
              </div>
            )
          })}
          {slots.length === 0 && <p className="text-[12px] text-[var(--muted-ink)]">No sessions this period — this therapist has capacity.</p>}
        </section>
      </>
    )
  } else if (selection.kind === 'pair') {
    const pair = model.pairs.get(selection.key)
    if (!pair) return null
    heading = `${therapistName(pair.therapistId)} ↔ ${clientName(pair.clientId)}`
    body = (
      <PairSection
        pair={pair}
        model={model}
        moveTargets={moveTargets}
        onAddSession={onAddSession}
        onRequestMove={onRequestMove}
        handlers={handlers}
        titleFor={() => clientName(pair.clientId)}
      />
    )
  } else {
    const cm = model.clients.get(selection.id)
    if (!cm) return null
    heading = cm.client.name
    body = (
      <>
        <section className="space-y-1 text-[12px] text-[var(--muted-ink)]">
          <p>
            {cm.client.code ?? 'No code'} · {cm.client.borough ?? 'Borough unset'}
          </p>
          <p>
            <span className="font-semibold tabular-nums text-[var(--espresso)]">{fmtH(cm.hours)} hrs/wk</span>
            {cm.client.authorizedHoursPerWeek != null && ` of ${fmtH(cm.client.authorizedHoursPerWeek)} authorized`}
            {cm.therapistIds.length > 1 && ` · shared by ${cm.therapistIds.length} therapists`}
          </p>
        </section>
        <button
          type="button"
          onClick={() => onAddSession({ clientId: cm.client.id })}
          className="flex h-8 w-fit items-center gap-1 rounded-lg bg-[var(--brand)] px-3 text-[12.5px] font-medium text-white hover:bg-[var(--brand-2)]"
        >
          <Plus className="h-3.5 w-3.5" /> Add session
        </button>
        {cm.therapistIds.map((tid) => {
          const pair = model.pairs.get(pairKey(tid, cm.client.id))
          if (!pair) return null
          return (
            <div key={tid} className="space-y-2 border-t border-[var(--line)] pt-3">
              <h4 className="font-display text-[13px] font-semibold text-[var(--espresso)]">{therapistName(tid)}</h4>
              <PairSection
                pair={pair}
                model={model}
                moveTargets={moveTargets}
                onAddSession={onAddSession}
                onRequestMove={onRequestMove}
                handlers={handlers}
                titleFor={() => therapistName(tid)}
                compact
              />
            </div>
          )
        })}
      </>
    )
  }

  return (
    <aside className="absolute inset-y-0 right-0 z-10 flex w-[380px] flex-col border-l border-[var(--line)] bg-white shadow-[-8px_0_24px_rgba(42,32,25,0.08)]">
      <header className="flex items-start justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <h3 className="font-display text-[16px] font-semibold leading-snug text-[var(--espresso)]">{heading}</h3>
        <button type="button" onClick={onClose} aria-label="Close panel" className="rounded p-1 text-[var(--muted-ink)] hover:bg-[var(--line-2)]">
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">{body}</div>
    </aside>
  )
}

function PairSection({
  pair,
  model,
  moveTargets,
  onAddSession,
  onRequestMove,
  handlers,
  titleFor,
  compact,
}: {
  pair: PairModel
  model: ConstellationModel
  moveTargets: Array<{ id: string; name: string }>
  onAddSession: (defaults: { therapistId?: string; clientId?: string }) => void
  onRequestMove: (opts: { clientId: string; fromTherapistId: string; toTherapistId: string }) => void
  handlers: SlotHandlers
  titleFor: (s: ScheduleSlot) => string
  compact?: boolean
}) {
  const [moveTo, setMoveTo] = useState('')
  const tm = model.therapists.get(pair.therapistId)
  return (
    <div className="space-y-2.5">
      {!compact && (
        <p className="text-[12px] text-[var(--muted-ink)]">
          <span className="font-semibold tabular-nums text-[var(--espresso)]">{fmtH(pair.hours)} hrs/wk</span> · {slotsLabel(pair.slots, 7)}
          {tm && ` · therapist at ${tm.hours.toFixed(1)} / ${fmtH(tm.target.hours)} hrs`}
        </p>
      )}
      {pair.conflictReasons.length > 0 && (
        <p className="rounded-md bg-[var(--urgent-bg)] px-2 py-1 text-[11.5px] font-medium text-[var(--urgent)]">
          ⚠ {pair.conflictReasons.join('; ')}
        </p>
      )}
      <SlotList slots={pair.slots} titleFor={titleFor} handlers={handlers} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onAddSession({ therapistId: pair.therapistId, clientId: pair.clientId })}
          className="flex h-7 items-center gap-1 rounded-md border border-[var(--line)] px-2.5 text-[11.5px] font-medium text-[var(--espresso)] hover:bg-[var(--line-2)]"
        >
          <Plus className="h-3 w-3" /> Add session
        </button>
        <div className="flex items-center gap-1">
          <select
            aria-label="Move these sessions to another therapist"
            value={moveTo}
            onChange={(e) => setMoveTo(e.target.value)}
            className="h-7 max-w-[150px] rounded-md border border-[var(--line)] bg-white px-1 text-[11.5px]"
          >
            <option value="">Move to…</option>
            {moveTargets
              .filter((t) => t.id !== pair.therapistId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
          <button
            type="button"
            disabled={!moveTo}
            title="Review reassignment"
            aria-label="Review reassignment"
            onClick={() => onRequestMove({ clientId: pair.clientId, fromTherapistId: pair.therapistId, toTherapistId: moveTo })}
            className="flex h-7 items-center rounded-md border border-[var(--line)] px-2 text-[var(--espresso)] hover:bg-[var(--line-2)] disabled:opacity-40"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
