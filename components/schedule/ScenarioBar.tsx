'use client'

import { useMemo, useState } from 'react'
import { Copy, FlaskConical, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { ScheduleClient } from '@/lib/schedule/types'
import { fmtH } from '@/lib/schedule/utils'
import {
  scenarioChangeCount,
  type ScheduleSummary,
  type ScenarioChanges,
} from '@/lib/schedule/scenario'
import type { ScheduleScenarioDto } from '@/lib/schedule/scenarioActions'
import { cn } from '@/lib/utils'

function Delta({ value, unit = '', digits = 0 }: { value: number; unit?: string; digits?: number }) {
  if (Math.abs(value) < 0.05) return <span className="text-[11px] text-quiet">no change</span>
  const up = value > 0
  return (
    <span className={cn('text-[11px] font-semibold tabular-nums', up ? 'text-[var(--ok,#2f7d4f)]' : 'text-[var(--urgent)]')}>
      {up ? '+' : '−'}
      {Math.abs(value).toFixed(digits)}
      {unit}
    </span>
  )
}

function Metric({
  label,
  value,
  delta,
  hint,
}: {
  label: string
  value: string
  delta?: React.ReactNode
  hint?: string
}) {
  return (
    <div className="min-w-[8.5rem] flex-1 rounded-lg border border-line bg-surface px-3 py-2" title={hint}>
      <div className="text-[11px] uppercase tracking-wide text-quiet">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-xl font-semibold tabular-nums text-ink">{value}</span>
        {delta}
      </div>
    </div>
  )
}

function utilization(s: ScheduleSummary): number | null {
  return s.authorizedHours > 0 ? (s.weeklyHours / s.authorizedHours) * 100 : null
}

export default function ScenarioBar({
  scenarios,
  activeId,
  onSelect,
  onCreate,
  onDuplicate,
  onRename,
  onDelete,
  mainSummary,
  activeSummary,
  activeChanges,
  clients,
  onPauseClient,
  onResumeClient,
  boroughFilter,
}: {
  scenarios: ScheduleScenarioDto[]
  activeId: string | null
  onSelect: (id: string | null) => void
  onCreate: () => void
  onDuplicate: (id: string) => void
  onRename: (id: string) => void
  onDelete: (id: string) => void
  mainSummary: ScheduleSummary
  activeSummary: ScheduleSummary | null
  activeChanges: ScenarioChanges | null
  clients: ScheduleClient[]
  onPauseClient: (client: ScheduleClient) => void
  onResumeClient: (clientId: string) => void
  boroughFilter: string
}) {
  const [showPayers, setShowPayers] = useState(false)
  const [pauseQuery, setPauseQuery] = useState('')
  const current = activeSummary ?? mainSummary
  const isScenario = activeSummary != null && activeChanges != null
  const util = utilization(current)
  const mainUtil = utilization(mainSummary)

  const pausable = useMemo(() => {
    if (!activeChanges) return []
    const paused = new Set(activeChanges.pausedClients.map((p) => p.id))
    const q = pauseQuery.trim().toLowerCase()
    if (!q) return []
    return clients.filter((c) => !paused.has(c.id) && c.name.toLowerCase().includes(q)).slice(0, 8)
  }, [clients, activeChanges, pauseQuery])

  const mainPayers = new Map(mainSummary.byPayer.map((p) => [p.payer, p]))

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Schedules">
        <button
          type="button"
          role="tab"
          aria-selected={activeId == null}
          onClick={() => onSelect(null)}
          className={cn(
            'h-8 rounded-lg px-3 text-sm font-medium',
            activeId == null ? 'bg-brand text-white' : 'border border-line text-ink hover:bg-[var(--line-2)]'
          )}
        >
          Main schedule
        </button>
        {scenarios.map((s) => {
          const n = scenarioChangeCount(s.changes)
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={activeId === s.id}
              onClick={() => onSelect(s.id)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium',
                activeId === s.id
                  ? 'bg-[var(--espresso)] text-white'
                  : 'border border-dashed border-line text-ink hover:bg-[var(--line-2)]'
              )}
            >
              <FlaskConical className="h-3.5 w-3.5" aria-hidden />
              {s.name}
              {n > 0 && <span className="rounded bg-black/10 px-1 text-[10px] tabular-nums">{n}</span>}
            </button>
          )
        })}
        <button
          type="button"
          onClick={onCreate}
          className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm text-quiet hover:bg-[var(--line-2)] hover:text-ink"
        >
          <Plus className="h-4 w-4" /> New scenario
        </button>
        {activeId && (
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => onRename(activeId)} className="rounded p-1.5 text-quiet hover:bg-[var(--line-2)]" title="Rename scenario" aria-label="Rename scenario">
              <Pencil className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => onDuplicate(activeId)} className="rounded p-1.5 text-quiet hover:bg-[var(--line-2)]" title="Duplicate scenario" aria-label="Duplicate scenario">
              <Copy className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => onDelete(activeId)} className="rounded p-1.5 text-[var(--urgent)] hover:bg-[var(--urgent-bg)]" title="Delete scenario" aria-label="Delete scenario">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {isScenario && (
        <p className="rounded-lg bg-[var(--amber-bg)] px-3 py-1.5 text-[12.5px] text-[var(--espresso)]">
          Sandbox — edits in this tab only change the scenario. The live schedule, therapists, and families are not affected.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Metric
          label="Clients served"
          value={String(current.clientsServed)}
          delta={isScenario ? <Delta value={current.clientsServed - mainSummary.clientsServed} /> : undefined}
        />
        <Metric
          label="Weekly hours"
          value={fmtH(current.weeklyHours)}
          delta={isScenario ? <Delta value={current.weeklyHours - mainSummary.weeklyHours} digits={1} unit=" h" /> : undefined}
        />
        <Metric
          label="Sessions / wk"
          value={String(current.sessions)}
          delta={isScenario ? <Delta value={current.sessions - mainSummary.sessions} /> : undefined}
        />
        <Metric
          label="Therapists working"
          value={String(current.therapistsWorking)}
          delta={isScenario ? <Delta value={current.therapistsWorking - mainSummary.therapistsWorking} /> : undefined}
        />
        <Metric
          label="Of authorized hours"
          value={util == null ? '—' : `${util.toFixed(0)}%`}
          hint={`${fmtH(current.weeklyHours)} scheduled of ${fmtH(current.authorizedHours)} authorized hrs/wk for clients being served`}
          delta={isScenario && util != null && mainUtil != null ? <Delta value={util - mainUtil} unit=" pts" /> : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[12px] text-quiet">
        <button type="button" onClick={() => setShowPayers((v) => !v)} className="font-medium text-ink hover:underline">
          {showPayers ? 'Hide' : 'Show'} hours by payer
        </button>
        {boroughFilter && <span>Filtered to {boroughFilter}</span>}
      </div>

      {showPayers && (
        <div className="overflow-x-auto">
          <table className="w-full max-w-2xl text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left text-quiet">
                <th className="py-1 pr-3 font-medium">Payer</th>
                <th className="py-1 pr-3 text-right font-medium">Clients</th>
                <th className="py-1 pr-3 text-right font-medium">Hours / wk</th>
                {isScenario && <th className="py-1 text-right font-medium">vs main</th>}
              </tr>
            </thead>
            <tbody>
              {current.byPayer.map((p) => (
                <tr key={p.payer} className="border-b border-line/60">
                  <td className="py-1 pr-3 text-ink">{p.payer}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{p.clients}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{fmtH(p.hours)}</td>
                  {isScenario && (
                    <td className="py-1 text-right">
                      <Delta value={p.hours - (mainPayers.get(p.payer)?.hours ?? 0)} digits={1} unit=" h" />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isScenario && activeChanges && (
        <div className="space-y-2 border-t border-line pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] font-semibold text-ink">
              Paused clients ({activeChanges.pausedClients.length})
            </span>
            <div className="relative">
              <input
                value={pauseQuery}
                onChange={(e) => setPauseQuery(e.target.value)}
                placeholder="Pause a client…"
                aria-label="Search clients to pause"
                className="h-8 w-56 rounded-lg border border-line bg-surface px-2 text-sm"
              />
              {pausable.length > 0 && (
                <ul className="absolute z-20 mt-1 w-72 rounded-lg border border-line bg-white py-1 shadow-lg">
                  {pausable.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onPauseClient(c)
                          setPauseQuery('')
                        }}
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--line-2)]"
                      >
                        {c.name}
                        <span className="ml-1 text-[11px] text-quiet">
                          {[c.insurance, c.borough].filter(Boolean).join(' · ')}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {activeChanges.pausedClients.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {activeChanges.pausedClients.map((p) => (
                <span
                  key={p.id}
                  className="flex items-center gap-1 rounded-full border border-line bg-[var(--line-2)] py-0.5 pl-2.5 pr-1 text-[12px] text-ink"
                >
                  {p.name}
                  <button
                    type="button"
                    onClick={() => onResumeClient(p.id)}
                    className="rounded-full p-0.5 hover:bg-black/10"
                    aria-label={`Resume ${p.name}`}
                    title="Resume in this scenario"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-quiet">
              No clients paused. Pause clients here or from a client&apos;s panel in Constellation view.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
