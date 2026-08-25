'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { X } from 'lucide-react'
import type {
  EthnicityPreference,
  GenderPreference,
} from '@prisma/client'
import AddressAutocomplete, {
  type StructuredAddress,
} from '@/components/ui/AddressAutocomplete'

const TherapistSearchMap = dynamic(
  () => import('@/components/admin/SchedulingBetaProximityMap'),
  { ssr: false }
)

/** Matches the pin colors in SchedulingBetaProximityMap so list rank === map pin. */
const RANK_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#f97316',
  '#a855f7',
  '#6b7280',
  '#0d9488',
] as const

type SearchClient = {
  id: string
  clientCode: string
  firstName: string
  lastName: string
  addressLine: string | null
  city: string | null
  state: string | null
  zip: string | null
  preferredRbtGender: GenderPreference | null
  preferredRbtEthnicities: EthnicityPreference[]
}

type ResultRow = {
  rbtProfileId: string
  firstName: string
  lastName: string
  fullAddress: string
  latitude: number | null
  longitude: number | null
  drivingDistanceMiles: number | null
  drivingDurationMinutes: number | null
  gender: string | null
  ethnicity: string | null
  status: string
  postHireStage: string | null
  transportation: boolean | null
  languagesJson: unknown
  preferenceMatch: {
    gender: boolean
    ethnicity: boolean
    hasGenderPreference: boolean
    hasEthnicityPreference: boolean
    matchCount: number
  }
}

type SearchResponse = {
  rbts: ResultRow[]
  message?: string
  clientLat: number | null
  clientLng: number | null
  preferences: {
    preferredRbtGender: GenderPreference | null
    preferredRbtEthnicities: EthnicityPreference[]
  }
}

const ETHNICITY_LABELS: Record<string, string> = {
  WHITE: 'White',
  ASIAN: 'Asian',
  BLACK: 'Black',
  HISPANIC: 'Hispanic',
  SOUTH_ASIAN: 'South Asian',
  MIDDLE_EASTERN: 'Middle Eastern',
}

function rankColor(index: number): string {
  return RANK_COLORS[index] ?? RANK_COLORS[5]
}

function formatDistance(miles: number | null): string {
  if (miles == null) return '—'
  if (miles < 0.1) return '< 0.1 mi'
  if (miles <= 10) return `${miles.toFixed(1)} mi`
  return `${Math.round(miles)} mi`
}

function formatDriveTime(minutes: number | null): string {
  if (minutes == null) return '—'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`
}

export default function TherapistSearchClient({
  client,
}: {
  client: SearchClient | null
}) {
  const [address, setAddress] = useState(client?.addressLine ?? '')
  const [city, setCity] = useState(client?.city ?? '')
  const [state, setState] = useState(client?.state ?? 'NY')
  const [zip, setZip] = useState(client?.zip ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set())
  const autoSearched = useRef(false)

  const searchedAddress = client
    ? [client.addressLine, client.city, client.state, client.zip]
        .filter(Boolean)
        .join(', ')
    : [address, city, state, zip].filter(Boolean).join(', ')

  const search = async () => {
    setLoading(true)
    setError(null)
    setHoveredIndex(null)
    setSelectedIndex(null)
    setDismissedIds(new Set())
    try {
      const response = await fetch('/api/client-services/therapist-search', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          client
            ? { clientId: client.id }
            : {
                clientAddress: address,
                clientCity: city,
                clientState: state,
                clientZip: zip,
              }
        ),
      })
      const data = (await response.json()) as SearchResponse & {
        error?: string
      }
      if (!response.ok) throw new Error(data.error || 'Search failed')
      setResult(data)
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!client || autoSearched.current) return
    autoSearched.current = true
    void search()
    // Run once for the server-loaded client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id])

  const prefGender = result?.preferences.preferredRbtGender ??
    client?.preferredRbtGender
  const prefEthnicities =
    result?.preferences.preferredRbtEthnicities ??
    client?.preferredRbtEthnicities ??
    []

  const visibleRbts = useMemo(() => {
    if (!result) return []
    return result.rbts.filter((rbt) => !dismissedIds.has(rbt.rbtProfileId))
  }, [result, dismissedIds])

  const dismissRbt = (rbtProfileId: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev)
      next.add(rbtProfileId)
      return next
    })
    setHoveredIndex(null)
    setSelectedIndex(null)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
          Staffing
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Therapist Search
        </h1>
        <p className="mt-1 text-sm text-quiet">
          Closest placeable RBTs, ranked primarily by drive time. Preferences
          lightly nudge nearby matches and never hide candidates.
        </p>
      </header>

      {client && (
        <section className="rounded-xl border border-line bg-[var(--sunrise-soft)] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--espresso)]">
                {client.firstName} {client.lastName}{' '}
                <span className="font-normal opacity-70">{client.clientCode}</span>
              </p>
              <p className="text-xs text-quiet">
                {[client.addressLine, client.city, client.state, client.zip]
                  .filter(Boolean)
                  .join(', ') || 'Address missing'}
              </p>
            </div>
            <Link
              href={`/client-services/clients/${client.id}?tab=staffing`}
              className="text-xs font-semibold text-brand hover:underline"
            >
              Back to client
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {prefGender && prefGender !== 'ANY' && (
              <span className="rounded-full bg-surface px-2 py-1 text-ink">
                Prefers {prefGender.toLowerCase()}
              </span>
            )}
            {prefEthnicities.map((ethnicity) => (
              <span
                key={ethnicity}
                className="rounded-full bg-surface px-2 py-1 text-ink"
              >
                {ETHNICITY_LABELS[ethnicity] ?? ethnicity}
              </span>
            ))}
            {(!prefGender || prefGender === 'ANY') &&
              prefEthnicities.length === 0 && (
                <span className="text-quiet">No therapist preferences set</span>
              )}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface p-4">
        {!client && (
          <div className="mb-3">
            <AddressAutocomplete
              id="therapist-search-address"
              label="Search address"
              placeholder="Start typing a client address..."
              onAddressSelect={(selected: StructuredAddress) => {
                setAddress(selected.addressLine1)
                setCity(selected.city)
                setState(selected.state || 'NY')
                setZip(selected.zipCode)
              }}
            />
            <p className="mt-1 text-xs text-quiet">
              Pick a suggestion to fill the fields below, or edit them directly.
            </p>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-quiet">
            Street address
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              disabled={!!client}
              className="mt-1 h-10 w-full rounded-lg border border-line bg-[var(--bg)] px-3 text-sm text-ink disabled:opacity-70"
            />
          </label>
          <label className="text-xs font-medium text-quiet">
            City
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              disabled={!!client}
              className="mt-1 h-10 w-full rounded-lg border border-line bg-[var(--bg)] px-3 text-sm text-ink disabled:opacity-70"
            />
          </label>
          <label className="text-xs font-medium text-quiet">
            State
            <input
              value={state}
              onChange={(event) => setState(event.target.value)}
              disabled={!!client}
              className="mt-1 h-10 w-full rounded-lg border border-line bg-[var(--bg)] px-3 text-sm text-ink disabled:opacity-70"
            />
          </label>
          <label className="text-xs font-medium text-quiet">
            ZIP
            <input
              value={zip}
              onChange={(event) => setZip(event.target.value)}
              disabled={!!client}
              className="mt-1 h-10 w-full rounded-lg border border-line bg-[var(--bg)] px-3 text-sm text-ink disabled:opacity-70"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void search()}
          disabled={loading || (!client && !address.trim() && !zip.trim())}
          className="mt-4 inline-flex h-10 items-center rounded-lg bg-[var(--espresso)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Calculating drive times…' : 'Find closest therapists'}
        </button>
        {error && (
          <p className="mt-3 text-sm text-[var(--urgent)]" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold text-ink">Map</h2>
        <TherapistSearchMap
          clientLat={result?.clientLat ?? null}
          clientLng={result?.clientLng ?? null}
          clientAddress={searchedAddress}
          rbts={visibleRbts}
          hoveredRbtIndex={hoveredIndex}
          selectedRbtIndex={selectedIndex}
        />
      </section>

      {result && (
        <section>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-ink">
              Closest placeable RBTs
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-quiet">
              <span>
                {visibleRbts.length} shown
                {dismissedIds.size > 0
                  ? ` · ${dismissedIds.size} removed`
                  : ''}
              </span>
              {dismissedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setDismissedIds(new Set())}
                  className="font-semibold text-brand hover:underline"
                >
                  Restore removed
                </button>
              )}
            </div>
          </div>
          {visibleRbts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-quiet">
              {result.rbts.length === 0
                ? result.message || 'No placeable RBTs found within 30 miles.'
                : 'All suggestions were removed. Restore them or run a new search.'}
            </p>
          ) : (
            <ol className="overflow-hidden rounded-xl border border-line bg-surface">
              {visibleRbts.map((rbt, index) => (
                <li
                  key={rbt.rbtProfileId}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => setSelectedIndex(index)}
                  className={`grid cursor-pointer gap-3 border-b border-line px-4 py-3 transition-colors last:border-b-0 md:grid-cols-[2rem_1.4fr_1fr_1fr_auto_auto] md:items-center ${
                    selectedIndex === index
                      ? 'bg-[var(--sunrise-soft)]'
                      : 'hover:bg-[var(--sunrise-soft)]'
                  }`}
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold tabular-nums text-white"
                    style={{ backgroundColor: rankColor(index) }}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <Link
                      href={`/admin/rbts/${rbt.rbtProfileId}`}
                      onClick={(event) => event.stopPropagation()}
                      className="font-display text-sm font-semibold text-ink hover:text-brand hover:underline"
                    >
                      {rbt.firstName} {rbt.lastName}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-quiet">
                      {rbt.fullAddress}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold tabular-nums text-[var(--espresso)]">
                      {formatDriveTime(rbt.drivingDurationMinutes)}
                    </p>
                    <p className="text-xs tabular-nums text-quiet">
                      {formatDistance(rbt.drivingDistanceMiles)} ·{' '}
                      {rbt.transportation ? 'Has car' : 'No car'}
                    </p>
                  </div>
                  <div className="text-xs">
                    <p className="text-ink">
                      {rbt.gender || 'Gender not recorded'} ·{' '}
                      {rbt.ethnicity
                        ? ETHNICITY_LABELS[rbt.ethnicity] ?? rbt.ethnicity
                        : 'Ethnicity not recorded'}
                    </p>
                    <p className="mt-0.5 text-quiet">
                      {rbt.status.replace(/_/g, ' ')} ·{' '}
                      {(rbt.postHireStage ?? 'MATCHING').replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 md:justify-end">
                    {rbt.preferenceMatch.gender && (
                      <span className="rounded-full bg-[var(--green-bg)] px-2 py-1 text-[10px] font-semibold text-[var(--green)]">
                        Gender ✓
                      </span>
                    )}
                    {rbt.preferenceMatch.ethnicity && (
                      <span className="rounded-full bg-[var(--green-bg)] px-2 py-1 text-[10px] font-semibold text-[var(--green)]">
                        Ethnicity ✓
                      </span>
                    )}
                    {rbt.preferenceMatch.matchCount === 0 && (
                      <span className="text-[10px] text-faint">Distance match</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      dismissRbt(rbt.rbtProfileId)
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center justify-self-end rounded-lg border border-line text-quiet hover:bg-[var(--urgent-bg)] hover:text-[var(--urgent)]"
                    title={`Remove ${rbt.firstName} from suggestions`}
                    aria-label={`Remove ${rbt.firstName} ${rbt.lastName} from suggestions`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  )
}
