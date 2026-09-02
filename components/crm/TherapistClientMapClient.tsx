'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  MapProximityResult,
  TherapistClientMapData,
} from '@/lib/crm/therapistClientMap/types'
import {
  CLIENT_COLORS,
  formatMapDistance,
  THERAPIST_COLORS,
  type MapSelection,
} from '@/components/crm/TherapistClientMap'
import { COVERAGE_STATES, normalizeUsState } from '@/lib/crm/therapistClientMap/coverageStates'
import { haversineMiles } from '@/lib/scheduling-beta/zipToCoord'
import { cn } from '@/lib/utils'

const TherapistClientMap = dynamic(
  () => import('@/components/crm/TherapistClientMap'),
  { ssr: false }
)

type LegendFilter =
  | 'therapist-green'
  | 'therapist-blue'
  | 'client-orange'
  | 'client-black'

function formatDriveTime(minutes: number | null): string {
  if (minutes == null) return '—'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

export default function TherapistClientMapClient() {
  const [data, setData] = useState<TherapistClientMapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [geocoding, setGeocoding] = useState(false)

  const [showTherapists, setShowTherapists] = useState(true)
  const [showClients, setShowClients] = useState(true)
  const [showPairLines, setShowPairLines] = useState(false)
  const [includePipeline, setIncludePipeline] = useState(true)
  const [stateFilter, setStateFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [legendHidden, setLegendHidden] = useState<Set<LegendFilter>>(
    () => new Set()
  )

  const [selected, setSelected] = useState<MapSelection>(null)
  const [proximity, setProximity] = useState<MapProximityResult | null>(null)
  const [proximityLoading, setProximityLoading] = useState(false)

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

  const toggleLegend = (key: LegendFilter) => {
    setLegendHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const q = search.trim().toLowerCase()

  const filteredTherapists = useMemo(() => {
    if (!data) return []
    return data.therapists.filter((t) => {
      if (!showTherapists) return false
      if (!includePipeline && t.markerColor === 'blue') return false
      if (legendHidden.has('therapist-green') && t.markerColor === 'green') {
        return false
      }
      if (legendHidden.has('therapist-blue') && t.markerColor === 'blue') {
        return false
      }
      if (stateFilter && normalizeUsState(t.state) !== stateFilter) return false
      if (q && !t.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [data, showTherapists, includePipeline, legendHidden, stateFilter, q])

  const filteredClients = useMemo(() => {
    if (!data) return []
    return data.clients.filter((c) => {
      if (!showClients) return false
      if (legendHidden.has('client-orange') && c.markerColor === 'orange') {
        return false
      }
      if (legendHidden.has('client-black') && c.markerColor === 'black') {
        return false
      }
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
  }, [data, showClients, legendHidden, stateFilter, q])

  const visibleTherapistIds = useMemo(
    () => new Set(filteredTherapists.map((t) => t.id)),
    [filteredTherapists]
  )
  const visibleClientIds = useMemo(
    () => new Set(filteredClients.map((c) => c.id)),
    [filteredClients]
  )

  const filteredPairs = useMemo(() => {
    if (!data) return []
    return data.assignmentPairs.filter(
      (p) =>
        visibleTherapistIds.has(p.therapistId) &&
        visibleClientIds.has(p.clientId)
    )
  }, [data, visibleTherapistIds, visibleClientIds])

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
    const tId = selected.type === 'therapist' ? selected.id : [...highlightedIds].find((id) => id !== selected.id)
    const cId = selected.type === 'client' ? selected.id : [...highlightedIds].find((id) => id !== selected.id)
    const t = data.therapists.find((x) => x.id === tId)
    const c = data.clients.find((x) => x.id === cId)
    if (!t || !c) return null
    return haversineMiles(c.lat, c.lng, t.lat, t.lng)
  }, [selected, highlightedIds, data])

  const runProximity = useCallback(async (clientId: string) => {
    setProximityLoading(true)
    setProximity(null)
    try {
      const res = await fetch(
        '/api/client-services/therapist-search/map-proximity',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId }),
        }
      )
      const json = (await res.json()) as MapProximityResult & { error?: string }
      if (!res.ok) throw new Error(json.error || 'Proximity failed')
      setProximity(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Proximity failed')
    } finally {
      setProximityLoading(false)
    }
  }, [])

  const onSelect = useCallback(
    (sel: MapSelection) => {
      setSelected(sel)
      setProximity(null)
      if (sel?.type === 'client') {
        const client = data?.clients.find((c) => c.id === sel.id)
        if (client?.needsStaffing) void runProximity(sel.id)
      }
    },
    [data, runProximity]
  )

  const runGeocodeAll = async () => {
    setGeocoding(true)
    setError(null)
    try {
      const res = await fetch('/api/client-services/clients/geocode-all', {
        method: 'POST',
        credentials: 'include',
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error || 'Geocode failed')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Geocode failed')
    } finally {
      setGeocoding(false)
    }
  }

  if (loading && !data) {
    return (
      <p className="rounded-xl border border-line bg-surface px-4 py-10 text-center text-sm text-quiet">
        Loading map data…
      </p>
    )
  }

  if (error && !data) {
    return (
      <p className="rounded-xl border border-[var(--urgent)] bg-[var(--urgent-bg)] px-4 py-6 text-sm text-[var(--urgent)]">
        {error}
      </p>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-xs text-quiet">
        <span>
          <strong className="text-ink">{data.stats.therapistMapped}</strong>/
          {data.stats.therapistTotal} therapists mapped
        </span>
        <span>·</span>
        <span>
          <strong className="text-ink">{data.stats.clientMapped}</strong>/
          {data.stats.clientTotal} clients mapped
        </span>
        <span>·</span>
        <span>
          <strong className="text-[var(--sunrise)]">
            {data.stats.clientsNeedingStaffing}
          </strong>{' '}
          need staffing
        </span>
        {data.unmapped.length > 0 && (
          <>
            <span>·</span>
            <button
              type="button"
              disabled={geocoding}
              onClick={() => void runGeocodeAll()}
              className="font-semibold text-brand hover:underline disabled:opacity-50"
            >
              {geocoding
                ? 'Geocoding…'
                : `Geocode ${data.unmapped.length} missing pin(s)`}
            </button>
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 rounded-xl border border-line bg-surface p-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or client code…"
              className="h-9 min-w-[180px] flex-1 rounded-lg border border-line bg-[var(--bg)] px-3 text-sm"
            />
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="h-9 rounded-lg border border-line bg-[var(--bg)] px-2 text-sm"
            >
              <option value="">All states</option>
              {COVERAGE_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={showTherapists}
                onChange={(e) => setShowTherapists(e.target.checked)}
              />
              Therapists
            </label>
            <label className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={showClients}
                onChange={(e) => setShowClients(e.target.checked)}
              />
              Clients
            </label>
            <label className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={showPairLines}
                onChange={(e) => setShowPairLines(e.target.checked)}
              />
              Match lines
            </label>
            <label className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={includePipeline}
                onChange={(e) => setIncludePipeline(e.target.checked)}
              />
              Pipeline (blue)
            </label>
          </div>

          <div
            className="flex flex-wrap gap-2 text-xs"
            role="group"
            aria-label="Legend filters"
          >
            {(
              [
                ['therapist-green', '● Hired', THERAPIST_COLORS.green],
                ['therapist-blue', '● Pipeline', THERAPIST_COLORS.blue],
                ['client-orange', '■ Needs staffing', CLIENT_COLORS.orange],
                ['client-black', '■ Settled', CLIENT_COLORS.black],
              ] as const
            ).map(([key, label, color]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleLegend(key)}
                className={cn(
                  'rounded-full border px-3 py-1.5 font-medium transition-opacity',
                  legendHidden.has(key) && 'opacity-40 line-through'
                )}
                style={{ borderColor: color }}
              >
                <span style={{ color }}>{label}</span>
              </button>
            ))}
            <span className="self-center text-quiet">
              ○ = therapist · ■ = client · white ring = has capacity
            </span>
          </div>

          <TherapistClientMap
            therapists={filteredTherapists}
            clients={filteredClients}
            pairs={filteredPairs}
            showPairLines={showPairLines}
            selected={selected}
            highlightedIds={highlightedIds}
            onSelect={onSelect}
          />
        </div>

        <aside className="space-y-3">
          {selectedEntity && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-quiet">
                    {selectedEntity.entityType === 'therapist'
                      ? 'Therapist'
                      : 'Client'}
                  </p>
                  <p className="font-display text-base font-semibold text-ink">
                    {'name' in selectedEntity ? selectedEntity.name : ''}
                  </p>
                  <p className="mt-1 text-sm text-quiet">
                    {selectedEntity.statusLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null)
                    setProximity(null)
                  }}
                  className="text-xs text-quiet hover:text-ink"
                >
                  Clear
                </button>
              </div>

              {selectedEntity.entityType === 'client' && (
                <div className="mt-3 space-y-1 text-sm">
                  <p>
                    Code:{' '}
                    <span className="font-medium">
                      {selectedEntity.clientCode}
                    </span>
                  </p>
                  <p>Stage: {selectedEntity.stage.replace(/_/g, ' ')}</p>
                  {selectedEntity.assignments.length > 0 && (
                    <p>
                      BTs:{' '}
                      {selectedEntity.assignments
                        .map((a) => a.btName)
                        .join(', ')}
                    </p>
                  )}
                  <Link
                    href={`/client-services/clients/${selectedEntity.id}?tab=staffing`}
                    className="mt-2 inline-block text-sm font-semibold text-brand hover:underline"
                  >
                    Open client record
                  </Link>
                  {selectedEntity.needsStaffing && (
                    <Link
                      href={`/client-services/therapist-search?clientId=${selectedEntity.id}&view=search`}
                      className="ml-3 inline-block text-sm font-semibold text-brand hover:underline"
                    >
                      Proximity search
                    </Link>
                  )}
                </div>
              )}

              {selectedEntity.entityType === 'therapist' && (
                <div className="mt-3 space-y-1 text-sm">
                  <p>
                    {selectedEntity.scheduledHoursPerWeek.toFixed(1)} /{' '}
                    {selectedEntity.weeklyHourCap} hrs scheduled
                  </p>
                  {selectedEntity.hasCapacity && (
                    <p className="text-[var(--green)]">Has remaining capacity</p>
                  )}
                  {selectedEntity.isUnmatched && (
                    <p className="text-[var(--green)]">Available — unmatched</p>
                  )}
                  <Link
                    href={`/admin/rbts/${selectedEntity.id}`}
                    className="mt-2 inline-block text-sm font-semibold text-brand hover:underline"
                  >
                    View RBT profile
                  </Link>
                </div>
              )}

              {pairDistanceMiles != null && highlightedIds.size > 1 && (
                <p className="mt-3 rounded-lg bg-[var(--sunrise-soft)] px-3 py-2 text-sm text-ink">
                  Distance to matched partner:{' '}
                  <strong>{formatMapDistance(pairDistanceMiles)}</strong>
                </p>
              )}
            </div>
          )}

          {proximityLoading && (
            <p className="rounded-xl border border-line bg-surface px-4 py-6 text-sm text-quiet">
              Finding nearest available therapists…
            </p>
          )}

          {proximity && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <h3 className="font-display text-sm font-semibold text-ink">
                Nearest available for {proximity.client.name}
              </h3>
              <p className="mt-1 text-xs text-quiet">
                Hired therapists in {normalizeUsState(proximity.client.state) ?? 'state'}{' '}
                with open match or remaining capacity, ranked by drive time.
              </p>
              {proximity.message && (
                <p className="mt-2 text-xs text-quiet">{proximity.message}</p>
              )}
              {proximity.therapists.length === 0 ? (
                <p className="mt-3 text-sm text-quiet">No candidates found.</p>
              ) : (
                <ol className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
                  {proximity.therapists.map((t, i) => (
                    <li
                      key={t.rbtProfileId}
                      className="rounded-lg border border-line px-3 py-2 text-sm"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-ink">
                          {i + 1}. {t.name}
                        </span>
                        <span className="tabular-nums text-xs text-quiet">
                          {formatDriveTime(t.drivingDurationMinutes)} ·{' '}
                          {formatMapDistance(t.drivingDistanceMiles)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-quiet">
                        {t.isUnmatched ? 'Unmatched' : 'Has capacity'} ·{' '}
                        {t.scheduledHoursPerWeek.toFixed(1)}/{t.weeklyHourCap}{' '}
                        hrs
                        {!t.stateViable && (
                          <span className="text-[var(--urgent)]">
                            {' '}
                            · Cross-state
                          </span>
                        )}
                      </p>
                      <div className="mt-1 flex gap-2">
                        <Link
                          href={`/admin/rbts/${t.rbtProfileId}`}
                          className="text-xs font-semibold text-brand hover:underline"
                        >
                          View
                        </Link>
                        <Link
                          href={`/client-services/clients/${proximity.client.id}?tab=staffing`}
                          className="text-xs font-semibold text-brand hover:underline"
                        >
                          Assign on client
                        </Link>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {data.unmapped.length > 0 && (
            <details className="rounded-xl border border-line bg-surface p-4">
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                Couldn&apos;t map ({data.unmapped.length})
              </summary>
              <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs text-quiet">
                {data.unmapped.map((u) => (
                  <li key={`${u.entityType}:${u.id}`}>
                    <span className="font-medium text-ink">{u.name}</span>
                    <br />
                    {u.addressSummary}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </aside>
      </div>
    </div>
  )
}
