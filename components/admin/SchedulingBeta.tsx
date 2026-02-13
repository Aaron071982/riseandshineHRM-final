'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { zipToCoord, haversineMiles } from '@/lib/scheduling-beta/zipToCoord'
import SchedulingBetaMap from '@/components/admin/SchedulingBetaMap'
import { Users, UserPlus, MapPin, CalendarClock, Trash2, Map } from 'lucide-react'

const ETHNICITY_OPTIONS: { value: string; label: string }[] = [
  { value: '__none__', label: 'No preference' },
  { value: 'WHITE', label: 'White' },
  { value: 'ASIAN', label: 'Asian' },
  { value: 'BLACK', label: 'Black' },
  { value: 'HISPANIC', label: 'Hispanic' },
  { value: 'SOUTH_ASIAN', label: 'South Asian' },
  { value: 'MIDDLE_EASTERN', label: 'Middle Eastern' },
]

// 0=Sunday, 1=Monday, ..., 6=Saturday (for API and display)
const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

type RBT = {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string | null
  phone: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  zip: string | null
  ethnicity: string | null
}

type Client = {
  id: string
  name: string
  addressLine1: string
  city: string
  state: string
  zip: string
  preferredRbtEthnicity: string
}

type MatchResult = {
  rbt: RBT
  distanceMiles: number
}

type Assignment = {
  id: string
  clientId: string
  clientName: string
  rbtId: string
  rbtName: string
  daysOfWeek: number[]   // 0=Sun, 1=Mon, ..., 6=Sat
  timeStart: string
  timeEnd: string
  notes: string
}

function generateId(): string {
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function buildAddress(client: Client): string {
  return [client.addressLine1, client.city, client.state, client.zip].filter(Boolean).join(', ')
}

function buildRbtAddress(rbt: RBT): string {
  const parts = [rbt.addressLine1, rbt.addressLine2, rbt.city, rbt.state, rbt.zip].filter(Boolean)
  return parts.length ? parts.join(', ') : (rbt.zip ? rbt.zip : '')
}

export default function SchedulingBeta() {
  const [rbts, setRbts] = useState<RBT[]>([])
  const [loadingRbts, setLoadingRbts] = useState(true)
  const [clients, setClients] = useState<Client[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [matchResults, setMatchResults] = useState<Record<string, MatchResult[]>>({})

  const [formName, setFormName] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formCity, setFormCity] = useState('')
  const [formState, setFormState] = useState('NY')
  const [formZip, setFormZip] = useState('')
  const [formEthnicity, setFormEthnicity] = useState('__none__')

  const [assignClientId, setAssignClientId] = useState('')
  const [assignRbtId, setAssignRbtId] = useState('')
  const [assignDays, setAssignDays] = useState<number[]>([])
  const [assignTimeStart, setAssignTimeStart] = useState('')
  const [assignTimeEnd, setAssignTimeEnd] = useState('')
  const [assignNotes, setAssignNotes] = useState('')
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [mapClientId, setMapClientId] = useState<string | null>(null)
  const [mapRbtId, setMapRbtId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRbts() {
      try {
        const res = await fetch('/api/admin/scheduling-beta/rbts', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        setRbts(data.rbts ?? [])
      } catch (e) {
        console.error('Failed to load RBTs', e)
      } finally {
        setLoadingRbts(false)
      }
    }
    fetchRbts()
  }, [])

  async function fetchAssignments() {
    setAssignmentsLoading(true)
    try {
      const res = await fetch('/api/admin/scheduling-beta/assignments', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const list = (data.assignments ?? []).map((a: { id: string; clientId: string; clientName: string; rbtId: string; rbtName: string; daysOfWeek: number[]; timeStart: string; timeEnd: string; notes: string }) => ({
        id: a.id,
        clientId: a.clientId,
        clientName: a.clientName,
        rbtId: a.rbtId,
        rbtName: a.rbtName,
        daysOfWeek: a.daysOfWeek ?? [],
        timeStart: a.timeStart ?? '',
        timeEnd: a.timeEnd ?? '',
        notes: a.notes ?? '',
      }))
      setAssignments(list)
    } catch (e) {
      console.error('Failed to load assignments', e)
    } finally {
      setAssignmentsLoading(false)
    }
  }

  useEffect(() => {
    fetchAssignments()
  }, [])

  function handleAddClient(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) return
    setClients((prev) => [
      ...prev,
      {
        id: generateId(),
        name: formName.trim(),
        addressLine1: formAddress.trim(),
        city: formCity.trim(),
        state: formState.trim() || 'NY',
        zip: formZip.trim(),
        preferredRbtEthnicity: formEthnicity === '__none__' ? '' : formEthnicity,
      },
    ])
    setFormName('')
    setFormAddress('')
    setFormCity('')
    setFormState('NY')
    setFormZip('')
    setFormEthnicity('__none__')
  }

  function findClosestThree(client: Client): MatchResult[] {
    const clientCoord = zipToCoord(client.zip) ?? zipToCoord(client.city)
    if (!clientCoord) return []

    const withDistance: { rbt: RBT; distanceMiles: number }[] = []
    for (const rbt of rbts) {
      const rbtCoord = zipToCoord(rbt.zip) ?? zipToCoord(rbt.city)
      if (!rbtCoord) continue
      if (client.preferredRbtEthnicity && rbt.ethnicity !== client.preferredRbtEthnicity) continue
      const miles = haversineMiles(clientCoord.lat, clientCoord.lng, rbtCoord.lat, rbtCoord.lng)
      withDistance.push({ rbt, distanceMiles: Math.round(miles * 10) / 10 })
    }
    withDistance.sort((a, b) => a.distanceMiles - b.distanceMiles)
    return withDistance.slice(0, 3)
  }

  function handleFindClosest(clientId: string) {
    const client = clients.find((c) => c.id === clientId)
    if (!client) return
    const top3 = findClosestThree(client)
    setMatchResults((prev) => ({ ...prev, [clientId]: top3 }))
  }

  async function handleAddAssignment(e: React.FormEvent) {
    e.preventDefault()
    if (!assignClientId || !assignRbtId || assignDays.length === 0) return
    const client = clients.find((c) => c.id === assignClientId)
    const rbt = rbts.find((r) => r.id === assignRbtId)
    if (!client || !rbt) return
    setAssignmentsLoading(true)
    try {
      const res = await fetch('/api/admin/scheduling-beta/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          client: {
            name: client.name,
            addressLine1: client.addressLine1 || undefined,
            city: client.city || undefined,
            state: client.state || undefined,
            zip: client.zip || undefined,
            preferredRbtEthnicity: client.preferredRbtEthnicity || undefined,
          },
          rbtProfileId: assignRbtId,
          daysOfWeek: assignDays,
          timeStart: assignTimeStart.trim() || undefined,
          timeEnd: assignTimeEnd.trim() || undefined,
          notes: assignNotes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create assignment')
      }
      const data = await res.json()
      setAssignments((prev) => [
        ...prev,
        {
          id: data.assignment.id,
          clientId: data.assignment.clientId,
          clientName: data.assignment.clientName,
          rbtId: data.assignment.rbtId,
          rbtName: data.assignment.rbtName,
          daysOfWeek: data.assignment.daysOfWeek ?? [],
          timeStart: data.assignment.timeStart ?? '',
          timeEnd: data.assignment.timeEnd ?? '',
          notes: data.assignment.notes ?? '',
        },
      ])
      setAssignClientId('')
      setAssignRbtId('')
      setAssignDays([])
      setAssignTimeStart('')
      setAssignTimeEnd('')
      setAssignNotes('')
    } catch (err) {
      console.error(err)
      alert((err as Error).message || 'Failed to add assignment')
    } finally {
      setAssignmentsLoading(false)
    }
  }

  async function removeAssignment(id: string) {
    try {
      const res = await fetch(`/api/admin/scheduling-beta/assignments/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to remove')
      setAssignments((prev) => prev.filter((a) => a.id !== id))
    } catch (e) {
      console.error(e)
      alert('Failed to remove assignment')
    }
  }

  function toggleAssignDay(d: number) {
    setAssignDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)))
  }

  function formatDays(daysOfWeek: number[]) {
    if (!daysOfWeek.length) return ''
    return daysOfWeek.map((d) => DAYS_OF_WEEK.find((x) => x.value === d)?.label ?? String(d)).join(', ')
  }

  function formatTimeRange(a: Assignment) {
    if (a.timeStart && a.timeEnd) return `${a.timeStart}–${a.timeEnd}`
    if (a.timeStart) return `from ${a.timeStart}`
    if (a.timeEnd) return `until ${a.timeEnd}`
    return ''
  }

  const apiKey = typeof process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY === 'string'
    ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    : ''
  const mapClient = mapClientId ? clients.find((c) => c.id === mapClientId) : null
  const mapRbt = mapRbtId ? rbts.find((r) => r.id === mapRbtId) : null
  const originAddress = mapRbt ? buildRbtAddress(mapRbt) : ''
  const destAddress = mapClient ? buildAddress(mapClient) : ''
  const routeRequest =
    originAddress.trim() && destAddress.trim() && mapClient && mapRbt
      ? {
          originAddress,
          destinationAddress: destAddress,
          originLabel: 'RBT',
          destinationLabel: 'Client',
        }
      : null

  return (
    <>
      <div className="space-y-6">
      {/* Map: always visible - RBTs, clients, and driving route when a match is selected */}
      <Card className="border border-gray-200 dark:border-[var(--border-subtle)]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Map className="w-5 h-5" />
            Map — RBTs & clients
            {routeRequest && (
              <span className="text-sm font-normal text-gray-500 dark:text-[var(--text-tertiary)]">
                · Route: {mapRbt?.fullName} → {mapClient?.name}
              </span>
            )}
          </CardTitle>
          {routeRequest && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setMapClientId(null)
                setMapRbtId(null)
              }}
            >
              Clear route
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {apiKey ? (
            <SchedulingBetaMap
              apiKey={apiKey}
              rbts={rbts}
              clients={clients}
              route={routeRequest}
            />
          ) : (
            <p className="text-sm text-gray-500 py-4">
              Set <code className="bg-gray-100 dark:bg-[var(--bg-elevated)] px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in your <code className="bg-gray-100 dark:bg-[var(--bg-elevated)] px-1 rounded">.env</code> to see the map (use the same value as <code className="bg-gray-100 dark:bg-[var(--bg-elevated)] px-1 rounded">GOOGLE_MAPS_API_KEY</code> so the browser can load the map).
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* RBTs list */}
      <Card className="lg:col-span-1 border border-gray-200 dark:border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5" />
            RBTs (HIRED)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRbts ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : rbts.length === 0 ? (
            <p className="text-sm text-gray-500">No HIRED RBTs in the system.</p>
          ) : (
            <ul className="space-y-3 max-h-[400px] overflow-y-auto">
              {rbts.map((rbt) => (
                <li
                  key={rbt.id}
                  className="p-3 rounded-lg border border-gray-100 dark:border-[var(--border-subtle)] bg-gray-50 dark:bg-[var(--bg-elevated)] text-sm"
                >
                  <div className="font-medium text-gray-900 dark:text-[var(--text-primary)]">
                    {rbt.fullName}
                  </div>
                  {rbt.email && (
                    <div className="text-gray-600 dark:text-[var(--text-tertiary)] truncate">
                      {rbt.email}
                    </div>
                  )}
                  {(rbt.addressLine1 || rbt.city) && (
                    <div className="text-gray-500 dark:text-[var(--text-tertiary)] text-xs mt-1">
                      {[rbt.addressLine1, rbt.city, rbt.state, rbt.zip].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {rbt.ethnicity && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {rbt.ethnicity.replace('_', ' ')}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Clients + Add form + Assignments */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="border border-gray-200 dark:border-[var(--border-subtle)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="w-5 h-5" />
              Add client (in-memory, not saved)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddClient} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="client-name">Name *</Label>
                <Input
                  id="client-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Client name"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="client-address">Address line</Label>
                <Input
                  id="client-address"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Street address"
                />
              </div>
              <div>
                <Label htmlFor="client-city">City</Label>
                <Input
                  id="client-city"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  placeholder="City"
                />
              </div>
              <div>
                <Label htmlFor="client-state">State</Label>
                <Input
                  id="client-state"
                  value={formState}
                  onChange={(e) => setFormState(e.target.value)}
                  placeholder="NY"
                />
              </div>
              <div>
                <Label htmlFor="client-zip">ZIP *</Label>
                <Input
                  id="client-zip"
                  value={formZip}
                  onChange={(e) => setFormZip(e.target.value)}
                  placeholder="ZIP code (for distance)"
                  required
                />
              </div>
              <div>
                <Label>Preferred RBT ethnicity</Label>
                <Select value={formEthnicity} onValueChange={setFormEthnicity}>
                  <SelectTrigger>
                    <SelectValue placeholder="No preference" />
                  </SelectTrigger>
                  <SelectContent>
                    {ETHNICITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 flex items-end">
                <Button type="submit">Add client</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Client list + Find 3 closest */}
        <Card className="border border-gray-200 dark:border-[var(--border-subtle)]">
          <CardHeader>
            <CardTitle className="text-lg">Clients</CardTitle>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <p className="text-sm text-gray-500">Add a client above.</p>
            ) : (
              <ul className="space-y-4">
                {clients.map((client) => (
                  <li
                    key={client.id}
                    className="p-4 rounded-lg border border-gray-200 dark:border-[var(--border-subtle)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-medium">{client.name}</span>
                        <span className="text-gray-500 dark:text-[var(--text-tertiary)] text-sm ml-2">
                          {[client.addressLine1, client.city, client.state, client.zip]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                        {client.preferredRbtEthnicity && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Pref: {client.preferredRbtEthnicity.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleFindClosest(client.id)}
                      >
                        <MapPin className="w-4 h-4 mr-1" />
                        Find 3 closest RBTs
                      </Button>
                    </div>
                    {matchResults[client.id] && matchResults[client.id].length > 0 && (
                      <div className="mt-3 pl-2 border-l-2 border-primary">
                        <p className="text-xs font-medium text-gray-600 dark:text-[var(--text-tertiary)] mb-1">
                          Top 3 matches:
                        </p>
                        <ul className="text-sm space-y-2">
                          {matchResults[client.id].map((m, i) => (
                            <li key={m.rbt.id} className="flex flex-wrap items-center gap-2">
                              <span>
                                {i + 1}. {m.rbt.fullName} — {m.distanceMiles} mi
                                {m.rbt.ethnicity && ` (${m.rbt.ethnicity})`}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-primary h-7 px-2"
                                onClick={() => {
                                  setMapClientId(client.id)
                                  setMapRbtId(m.rbt.id)
                                }}
                              >
                                <Map className="w-3.5 h-3.5 mr-1" />
                                Map & drive time
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Assign RBT to client */}
        <Card className="border border-gray-200 dark:border-[var(--border-subtle)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarClock className="w-5 h-5" />
              Assign RBT to client (date/time)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddAssignment} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <Label>Client</Label>
                <Select value={assignClientId} onValueChange={setAssignClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>RBT</Label>
                <Select value={assignRbtId} onValueChange={setAssignRbtId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select RBT" />
                  </SelectTrigger>
                  <SelectContent>
                    {rbts.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Days (select all that apply)</Label>
                <div className="flex flex-wrap gap-3 pt-2">
                  {DAYS_OF_WEEK.map((d) => (
                    <label key={d.value} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={assignDays.includes(d.value)}
                        onChange={() => toggleAssignDay(d.value)}
                        className="rounded border-gray-300 dark:border-[var(--border-subtle)]"
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Time start (optional)</Label>
                <Input
                  value={assignTimeStart}
                  onChange={(e) => setAssignTimeStart(e.target.value)}
                  placeholder="e.g. 4:00 PM or 16:00"
                />
              </div>
              <div>
                <Label>Time end (optional)</Label>
                <Input
                  value={assignTimeEnd}
                  onChange={(e) => setAssignTimeEnd(e.target.value)}
                  placeholder="e.g. 7:00 PM or 19:00"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Notes (optional)</Label>
                <Input
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="e.g. 4-7 or 5-8, or session details"
                />
              </div>
              <div>
                <Button type="submit" disabled={assignmentsLoading}>
                  {assignmentsLoading ? 'Adding…' : 'Add assignment'}
                </Button>
              </div>
            </form>

            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)] mb-2">
                Current assignments
              </p>
              {assignmentsLoading && assignments.length === 0 ? (
                <p className="text-sm text-gray-500">Loading…</p>
              ) : assignments.length === 0 ? (
                <p className="text-sm text-gray-500">None yet. Add one above (saved to database).</p>
              ) : (
                <ul className="space-y-2">
                  {assignments.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between p-2 rounded border border-gray-100 dark:border-[var(--border-subtle)] text-sm"
                    >
                      <span>
                        {a.clientName} ← {a.rbtName}
                        {(() => {
                          const s = [formatDays(a.daysOfWeek), formatTimeRange(a)].filter(Boolean).join(' ')
                          return s ? ` (${s})` : ''
                        })()}
                        {a.notes ? ` — ${a.notes}` : ''}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => removeAssignment(a.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
      </div>
    </div>
    </>
  )
}
