'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ClientMarkerColor,
  TherapistClientMapData,
  TherapistMarkerColor,
} from '@/lib/crm/therapistClientMap/types'
import {
  CLIENT_STAGE_GROUP_HEX,
  clientStageGroupLabel,
  THERAPIST_MARKER_HEX,
} from '@/lib/crm/therapistClientMap/markerColors'
import { COVERAGE_STATES, normalizeUsState } from '@/lib/crm/therapistClientMap/coverageStates'
import { coverageStateListLabel } from '@/lib/crm/therapistClientMap/coordinateValidation'
import { formatMapDistance, type MapSelection } from '@/components/crm/TherapistClientMap'
import { STAGE_GROUP_LABELS, type StageGroupId } from '@/lib/crm/stages'
import { haversineMiles } from '@/lib/scheduling-beta/zipToCoord'
import { cn } from '@/lib/utils'

const TherapistClientMap = dynamic(
  () => import('@/components/crm/TherapistClientMap'),
  { ssr: false }
)

const CLIENT_LEGEND: { id: ClientMarkerColor; label: string }[] = (
  Object.keys(STAGE_GROUP_LABELS) as StageGroupId[]
).map((id) => ({
  id,
  label: clientStageGroupLabel(id),
}))

const THERAPIST_LEGEND: { id: TherapistMarkerColor; label: string }[] = [
  { id: 'green', label: 'Actively working' },
  { id: 'red', label: 'Not actively working' },
]

export default function TherapistClientMapClient() {
  const [data, setData] = useState<TherapistClientMapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [geocoding, setGeocoding] = useState(false)

  const [showTherapists, setShowTherapists] = useState(true)
  const [showClients, setShowClients] = useState(true)
  const [stateFilter, setStateFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [hiddenTherapistColors, setHiddenTherapistColors] = useState<
    Set<TherapistMarkerColor>
  >(() => new Set())
  const [hiddenClientGroups, setHiddenClientGroups] = useState<
    Set<ClientMarkerColor>
  >(() => new Set())
  const [showExcluded, setShowExcluded] = useState(false)

  const [selected, setSelected] = useState<MapSelection>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/client-services/therapist-search/map-data', {
        credentials: 'include',
      })
      const json = (await res.json()) as TherapistClientMapData & {
        error?: string
      }
      if (!res.ok) throw new Error(json.error || 'Failed to load map')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load map')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const toggleTherapistColor = (color: TherapistMarkerColor) => {
    setHiddenTherapistColors((prev) => {
      const next = new Set(prev)
      if (next.has(color)) next.delete(color)
      else next.add(color)
      return next
    })
  }

  const toggleClientGroup = (group: ClientMarkerColor) => {
    setHiddenClientGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  const q = search.trim().toLowerCase()

  const filteredTherapists = useMemo(() => {
    if (!data) return []
    return data.therapists.filter((t) => {
      if (!showTherapists) return false
      if (hiddenTherapistColors.has(t.markerColor)) return false
      if (stateFilter && normalizeUsState(t.state) !== stateFilter) return false
      if (q && !t.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [data, showTherapists, hiddenTherapistColors, stateFilter, q])

  const filteredClients = useMemo(() => {
    if (!data) return []
    return data.clients.filter((c) => {
      if (!showClients) return false
      if (hiddenClientGroups.has(c.markerColor)) return false
      if (stateFilter && normalizeUsState(c.state) !== stateFilter) return false
      if (
        q &&
        !c.name.toLowerCase().includes(q) &&
        !c.clientCode.toLowerCase().includes(q)
      ) {
        return false
      }
      return true
    })
  }, [data, showClients, hiddenClientGroups, stateFilter, q])

  const highlightedIds = useMemo(() => {
    const ids = new Set<string>()
    if (!selected || !data) return ids
    ids.add(selected.id)
    if (selected.type === 'therapist') {
      for (const p of data.assignmentPairs) {
        if (p.therapistId === selected.id) ids.add(p.clientId)
      }
    } else {
      for (const p of data.assignmentPairs) {
        if (p.clientId === selected.id) ids.add(p.therapistId)
      }
    }
    return ids
  }, [selected, data])

  const selectedEntity = useMemo(() => {
    if (!selected || !data) return null
    if (selected.type === 'therapist') {
      return data.therapists.find((t) => t.id === selected.id) ?? null
    }
    return data.clients.find((c) => c.id === selected.id) ?? null
  }, [selected, data])

  const pairDistanceMiles = useMemo(() => {
    if (!selected || highlightedIds.size < 2 || !data) return null
    const tId =
      selected.type === 'therapist'
        ? selected.id
        : [...highlightedIds].find((id) => id !== selected.id)
    const cId =
      selected.type === 'client'
        ? selected.id
        : [...highlightedIds].find((id) => id !== selected.id)
    const t = data.therapists.find((x) => x.id === tId)
    const c = data.clients.find((x) => x.id === cId)
    if (!t || !c) return null
    return haversineMiles(c.lat, c.lng, t.lat, t.lng)
  }, [selected, highlightedIds, data])

  const runGeocodeRefresh = async () => {
    setGeocoding(true)
    setError(null)
    try {
      const res = await fetch('/api/client-services/clients/geocode-all', {
        method: 'POST',
        credentials: 'include',
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error || 'Geocode refresh failed')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Geocode refresh failed')
    } finally {
      setGeocoding(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-quiet">
        Loading map…
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-sm text-[var(--urgent)]">
        {error}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="relative h-full min-h-0 w-full">
      <TherapistClientMap
        therapists={filteredTherapists}
        clients={filteredClients}
        selected={selected}
        highlightedIds={highlightedIds}
        onSelect={setSelected}
      />

      {/* Top controls */}
      <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-wrap items-start justify-between gap-2 px-3 sm:px-4">
        <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-line/80 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or client code…"
            className="h-8 min-w-[160px] flex-1 rounded-lg border border-line bg-white px-3 text-sm"
          />
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="h-8 rounded-lg border border-line bg-white px-2 text-sm"
          >
            <option value="">All states</option>
            {COVERAGE_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs font-medium text-ink">
            <input
              type="checkbox"
              checked={showClients}
              onChange={(e) => setShowClients(e.target.checked)}
            />
            Clients ●
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium text-ink">
            <input
              type="checkbox"
              checked={showTherapists}
              onChange={(e) => setShowTherapists(e.target.checked)}
            />
            Therapists ▲
          </label>
        </div>

        <div className="pointer-events-auto rounded-xl border border-line/80 bg-white/95 px-3 py-2 text-xs text-quiet shadow-lg backdrop-blur-sm">
          <span className="font-semibold text-ink">{data.stats.clientMapped}</span>{' '}
          clients ·{' '}
          <span className="font-semibold text-ink">{data.stats.therapistMapped}</span>{' '}
          therapists
          {data.stats.excludedCount > 0 && (
            <>
              {' '}
              ·{' '}
              <button
                type="button"
                onClick={() => setShowExcluded((v) => !v)}
                className="font-semibold text-brand hover:underline"
              >
                {data.stats.excludedCount} excluded
              </button>
            </>
          )}
          {(data.stats.excludedCount > 0 || data.stats.clientMapped === 0) && (
            <>
              {' '}
              ·{' '}
              <button
                type="button"
                disabled={geocoding}
                onClick={() => void runGeocodeRefresh()}
                className="font-semibold text-brand hover:underline disabled:opacity-50"
              >
                {geocoding ? 'Refreshing pins…' : 'Refresh geocoding'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="pointer-events-auto absolute left-3 right-3 top-[4.5rem] z-10 rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-xs text-[var(--urgent)] shadow">
          {error}
        </div>
      )}

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-4 left-3 z-10 max-w-[min(100%-1.5rem,420px)] sm:left-4">
        <div className="pointer-events-auto rounded-xl border border-line/80 bg-white/95 px-3 py-3 shadow-lg backdrop-blur-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-quiet">
            Legend
          </p>
          <div className="mt-2 space-y-2">
            <div>
              <p className="text-[11px] font-semibold text-ink">Clients (●)</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {CLIENT_LEGEND.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleClientGroup(id)}
                    className={cn(
                      'rounded-full border px-2 py-1 text-[11px] font-medium',
                      hiddenClientGroups.has(id) && 'opacity-40 line-through'
                    )}
                    style={{
                      borderColor: CLIENT_STAGE_GROUP_HEX[id],
                      color: CLIENT_STAGE_GROUP_HEX[id],
                    }}
                  >
                    ● {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-ink">Therapists (▲)</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {THERAPIST_LEGEND.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleTherapistColor(id)}
                    className={cn(
                      'rounded-full border px-2 py-1 text-[11px] font-medium',
                      hiddenTherapistColors.has(id) && 'opacity-40 line-through'
                    )}
                    style={{
                      borderColor: THERAPIST_MARKER_HEX[id],
                      color: THERAPIST_MARKER_HEX[id],
                    }}
                  >
                    ▲ {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[10px] leading-snug text-quiet">
            Only verified pins in {coverageStateListLabel()} are shown. Bad or
            missing geocodes are excluded.
          </p>
        </div>
      </div>

      {/* Selection card */}
      {selectedEntity && (
        <div className="pointer-events-auto absolute bottom-4 right-3 z-10 w-[min(100%-1.5rem,320px)] rounded-xl border border-line/80 bg-white/95 p-4 shadow-lg backdrop-blur-sm sm:right-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-quiet">
                {selectedEntity.entityType === 'therapist'
                  ? '▲ Therapist'
                  : '● Client'}
              </p>
              <p className="font-display text-base font-semibold text-ink">
                {selectedEntity.name}
              </p>
              <p className="mt-0.5 text-sm text-quiet">
                {selectedEntity.statusLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs text-quiet hover:text-ink"
            >
              ✕
            </button>
          </div>

          {selectedEntity.entityType === 'client' && (
            <div className="mt-3 space-y-1 text-sm">
              <p>
                Code:{' '}
                <span className="font-medium">{selectedEntity.clientCode}</span>
              </p>
              {selectedEntity.needsStaffing && (
                <p className="text-[var(--sunrise)]">Needs staffing attention</p>
              )}
              {selectedEntity.assignments.length > 0 && (
                <p className="text-xs text-quiet">
                  BTs:{' '}
                  {selectedEntity.assignments.map((a) => a.btName).join(', ')}
                </p>
              )}
              <Link
                href={`/client-services/clients/${selectedEntity.id}?tab=staffing`}
                className="mt-2 inline-block text-sm font-semibold text-brand hover:underline"
              >
                Open client record
              </Link>
            </div>
          )}

          {selectedEntity.entityType === 'therapist' && (
            <div className="mt-3 space-y-1 text-sm">
              <p className="text-xs text-quiet">
                {selectedEntity.scheduledHoursPerWeek.toFixed(1)} /{' '}
                {selectedEntity.weeklyHourCap} hrs scheduled
              </p>
              <Link
                href={`/admin/rbts/${selectedEntity.id}`}
                className="mt-2 inline-block text-sm font-semibold text-brand hover:underline"
              >
                View RBT profile
              </Link>
            </div>
          )}

          {pairDistanceMiles != null && highlightedIds.size > 1 && (
            <p className="mt-3 rounded-lg bg-[var(--sunrise-soft)] px-3 py-2 text-xs text-ink">
              Distance to match:{' '}
              <strong>{formatMapDistance(pairDistanceMiles)}</strong>
            </p>
          )}
        </div>
      )}

      {/* Excluded list */}
      {showExcluded && data.excluded.length > 0 && (
        <div className="pointer-events-auto absolute right-3 top-[4.5rem] z-10 max-h-[min(50vh,360px)] w-[min(100%-1.5rem,340px)] overflow-hidden rounded-xl border border-line/80 bg-white/95 shadow-lg backdrop-blur-sm sm:right-4">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-sm font-semibold text-ink">
              Excluded ({data.excluded.length})
            </p>
            <button
              type="button"
              onClick={() => setShowExcluded(false)}
              className="text-xs text-quiet hover:text-ink"
            >
              Close
            </button>
          </div>
          <ul className="max-h-[calc(min(50vh,360px)-2.5rem)] space-y-2 overflow-y-auto px-3 py-2 text-xs">
            {data.excluded.map((row) => (
              <li key={`${row.entityType}:${row.id}`} className="border-b border-line/60 pb-2 last:border-0">
                <p className="font-medium text-ink">{row.name}</p>
                <p className="text-quiet">{row.reason}</p>
                <p className="text-quiet">{row.addressSummary}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
