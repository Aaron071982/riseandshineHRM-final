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
import dynamic from 'next/dynamic'
import { Users, UserPlus, MapPin, CalendarClock, Trash2, Map, Loader2, Copy, Check, Ban, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/toast'

const SchedulingBetaProximityMap = dynamic(
  () => import('@/components/admin/SchedulingBetaProximityMap'),
  { ssr: false }
)
import AddressAutocomplete from '@/components/ui/AddressAutocomplete'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

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
  addressLine2?: string
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

function formatDrivingDistance(miles: number | null): string {
  if (miles == null) return ''
  if (miles === 0 || miles < 0.1) return '< 0.1 mi'
  if (miles < 1) return `${miles.toFixed(1)} mi`
  if (miles <= 10) return `${miles.toFixed(1)} mi`
  return `${Math.round(miles)} mi`
}

function formatDrivingTime(minutes: number | null): string {
  if (minutes == null) return ''
  if (minutes < 60) return `~${Math.round(minutes)} min drive`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (m === 0) return `~${h} hr drive`
  return `~${h} hr ${m} min drive`
}

export default function SchedulingBeta() {
  const { showToast } = useToast()
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

  // Proximity finder
  const [proxClientName, setProxClientName] = useState('')
  const [proxAddress, setProxAddress] = useState('')
  const [proxCity, setProxCity] = useState('')
  const [proxState, setProxState] = useState('')
  const [proxZip, setProxZip] = useState('')
  const [proxClientLngLat, setProxClientLngLat] = useState<{ lng: number; lat: number } | null>(null)
  const [proxLoading, setProxLoading] = useState(false)
  const [proxError, setProxError] = useState<string | null>(null)
  const [proxResult, setProxResult] = useState<{
    rbts: Array<{
      rbtProfileId: string
      firstName: string
      lastName: string
      fullAddress: string
      latitude: number | null
      longitude: number | null
      drivingDistanceMiles: number | null
      drivingDurationMinutes: number | null
      transportation: boolean | null
      languagesJson: unknown
      availabilityDayOfWeeks: number[]
      phoneNumber: string
      email: string | null
      status: string
    }>
    excludedCount?: number
    activeExcludedCount?: number
    clientLat?: number | null
    clientLng?: number | null
  } | null>(null)
  const [exclusions, setExclusions] = useState<
    Array<{
      id: string
      rbtProfileId: string
      reason: string | null
      expiresAt: string | null
      createdAt: string
      rbtProfile: { id: string; firstName: string; lastName: string }
      excludedBy: { id: string; name: string | null; email: string | null }
      active: boolean
    }>
  >([])
  const [excludedPanelOpen, setExcludedPanelOpen] = useState(false)
  const [excludePopoverForId, setExcludePopoverForId] = useState<string | null>(null)
  const [excludeReason, setExcludeReason] = useState('')
  const [excludeExpiryPreset, setExcludeExpiryPreset] = useState<'2w' | '1m' | '3m' | 'none'>('1m')
  const [excludingId, setExcludingId] = useState<string | null>(null)
  const [restoreConfirmId, setRestoreConfirmId] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [fadingOutResultIds, setFadingOutResultIds] = useState<Record<string, true>>({})
  const [fadingOutExclusionIds, setFadingOutExclusionIds] = useState<Record<string, true>>({})
  const [geocodeStats, setGeocodeStats] = useState<{ totalHired: number; withCoords: number } | null>(null)
  const [geocodeLoading, setGeocodeLoading] = useState(false)
  const [geocodeMessage, setGeocodeMessage] = useState<{ success: string; failedNames?: string[] } | null>(null)
  const [assignModalRbtId, setAssignModalRbtId] = useState<string | null>(null)
  const [assignModalClientId, setAssignModalClientId] = useState('')
  const [assignModalDays, setAssignModalDays] = useState<number[]>([])
  const [assignModalTimeStart, setAssignModalTimeStart] = useState('')
  const [assignModalTimeEnd, setAssignModalTimeEnd] = useState('')
  const [assignModalNotes, setAssignModalNotes] = useState('')
  const [assignModalSubmitting, setAssignModalSubmitting] = useState(false)
  const [copyFeedbackId, setCopyFeedbackId] = useState<string | null>(null)
  const [proxHoveredRbtIndex, setProxHoveredRbtIndex] = useState<number | null>(null)
  const [proxSelectedRbtIndex, setProxSelectedRbtIndex] = useState<number | null>(null)

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

  async function fetchClients() {
    try {
      const res = await fetch('/api/admin/scheduling-beta/clients', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const list = (data.clients ?? []).map((c: { id: string; name: string; addressLine1: string; addressLine2?: string; city: string; state: string; zip: string; preferredRbtEthnicity: string }) => ({
        id: c.id,
        name: c.name,
        addressLine1: c.addressLine1 ?? '',
        addressLine2: c.addressLine2 ?? '',
        city: c.city ?? '',
        state: c.state ?? '',
        zip: c.zip ?? '',
        preferredRbtEthnicity: c.preferredRbtEthnicity ?? '',
      }))
      setClients(list)
    } catch (e) {
      console.error('Failed to load clients', e)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  async function fetchGeocodeStats() {
    try {
      const res = await fetch('/api/admin/scheduling-beta/geocode-stats', { credentials: 'include' })
      if (res.ok) {
        const d = await res.json()
        setGeocodeStats({ totalHired: d.totalHired ?? 0, withCoords: d.withCoords ?? 0 })
      } else {
        setGeocodeStats({ totalHired: 0, withCoords: 0 })
      }
    } catch (e) {
      console.error('Failed to load geocode stats', e)
      setGeocodeStats({ totalHired: 0, withCoords: 0 })
    }
  }

  useEffect(() => {
    fetchGeocodeStats()
  }, [])

  async function fetchExclusions() {
    try {
      const res = await fetch('/api/admin/scheduling/exclusions', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setExclusions(data.exclusions ?? [])
    } catch (e) {
      console.error('Failed to load exclusions', e)
    }
  }

  useEffect(() => {
    fetchExclusions()
  }, [])

  function computeExpiryDate(preset: '2w' | '1m' | '3m' | 'none'): string | null {
    if (preset === 'none') return null
    const now = new Date()
    const expires = new Date(now)
    if (preset === '2w') expires.setDate(expires.getDate() + 14)
    if (preset === '1m') expires.setMonth(expires.getMonth() + 1)
    if (preset === '3m') expires.setMonth(expires.getMonth() + 3)
    return expires.toISOString()
  }

  function formatDateShort(iso: string | null): string {
    if (!iso) return 'No expiry'
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/New_York',
    })
  }

  function timeRemainingLabel(iso: string | null): { label: string; expired: boolean } {
    if (!iso) return { label: 'No expiry', expired: false }
    const end = new Date(iso).getTime()
    const diffMs = end - Date.now()
    if (diffMs <= 0) return { label: 'Expired', expired: true }
    const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000))
    return { label: `${days} day${days === 1 ? '' : 's'} left`, expired: false }
  }

  async function runProximitySearch() {
    setProxError(null)
    setProxResult(null)
    setProxClientLngLat(null)
    setProxHoveredRbtIndex(null)
    setProxSelectedRbtIndex(null)
    const full = [proxAddress, proxCity, proxState, proxZip].filter(Boolean).join(', ').trim()
    if (!full) {
      setProxError('Please enter a client address.')
      return
    }
    setProxLoading(true)
    try {
      const res = await fetch('/api/admin/scheduling-beta/proximity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clientAddress: proxAddress,
          clientCity: proxCity,
          clientState: proxState,
          clientZip: proxZip,
          limit: 6,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setProxError(data.error ?? 'Search failed')
        return
      }
      if (data.error && data.code === 'GEOCODE_FAILED') {
        setProxError(data.error)
        return
      }
      setProxResult({
        rbts: data.rbts ?? [],
        excludedCount: data.excludedCount,
        activeExcludedCount: data.activeExcludedCount,
        clientLat: data.clientLat ?? null,
        clientLng: data.clientLng ?? null,
      })
      if (data.clientLng != null && data.clientLat != null) {
        setProxClientLngLat({ lng: data.clientLng, lat: data.clientLat })
      }
    } catch (e) {
      console.error(e)
      setProxError('Search failed')
    } finally {
      setProxLoading(false)
    }
  }

  async function runGeocodeAll() {
    setGeocodeMessage(null)
    setGeocodeLoading(true)
    try {
      const res = await fetch('/api/admin/rbts/geocode-all', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) {
        setGeocodeMessage({ success: data.error ?? 'Request failed' })
        return
      }
      const failedNames = data.failedNames ?? []
      setGeocodeMessage({
        success: `Successfully geocoded ${data.geocoded ?? 0} RBTs. ${data.failed ?? 0} failed (missing or invalid address).`,
        failedNames: failedNames.length ? failedNames : undefined,
      })
      fetchGeocodeStats()
    } catch (e) {
      console.error(e)
      setGeocodeMessage({ success: 'Request failed' })
    } finally {
      setGeocodeLoading(false)
    }
  }

  async function excludeRbtFromResults(rbt: { rbtProfileId: string; firstName: string; lastName: string }) {
    setExcludingId(rbt.rbtProfileId)
    try {
      const expiresAt = computeExpiryDate(excludeExpiryPreset)
      const res = await fetch('/api/admin/scheduling/exclusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          rbtProfileId: rbt.rbtProfileId,
          reason: excludeReason.trim() || null,
          expiresAt,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Failed to exclude RBT', 'error')
        return
      }
      setFadingOutResultIds((prev) => ({ ...prev, [rbt.rbtProfileId]: true }))
      setTimeout(() => {
        setProxResult((prev) =>
          prev
            ? {
                ...prev,
                rbts: prev.rbts.filter((x) => x.rbtProfileId !== rbt.rbtProfileId),
                activeExcludedCount: (prev.activeExcludedCount ?? 0) + 1,
              }
            : prev
        )
        setFadingOutResultIds((prev) => {
          const next = { ...prev }
          delete next[rbt.rbtProfileId]
          return next
        })
      }, 250)
      setExcludePopoverForId(null)
      setExcludeReason('')
      setExcludeExpiryPreset('1m')
      showToast(`${rbt.firstName} ${rbt.lastName} excluded from proximity results`, 'success')
      fetchExclusions()
    } catch (e) {
      console.error(e)
      showToast('Failed to exclude RBT', 'error')
    } finally {
      setExcludingId(null)
    }
  }

  async function restoreExclusion(exclusion: { id: string; rbtProfile: { firstName: string; lastName: string } }) {
    setRestoringId(exclusion.id)
    try {
      const res = await fetch(`/api/admin/scheduling/exclusions/${exclusion.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        showToast('Failed to restore RBT', 'error')
        return
      }
      setFadingOutExclusionIds((prev) => ({ ...prev, [exclusion.id]: true }))
      setTimeout(() => {
        setExclusions((prev) => prev.filter((x) => x.id !== exclusion.id))
        setFadingOutExclusionIds((prev) => {
          const next = { ...prev }
          delete next[exclusion.id]
          return next
        })
      }, 250)
      setProxResult((prev) =>
        prev ? { ...prev, activeExcludedCount: Math.max(0, (prev.activeExcludedCount ?? 0) - 1) } : prev
      )
      setRestoreConfirmId(null)
      showToast(`${exclusion.rbtProfile.firstName} ${exclusion.rbtProfile.lastName} has been restored to results`, 'success')
    } catch (e) {
      console.error(e)
      showToast('Failed to restore RBT', 'error')
    } finally {
      setRestoringId(null)
    }
  }

  async function copyContact(rbt: { firstName: string; lastName: string; phoneNumber: string; email: string | null }, id: string) {
    const text = `Name: ${rbt.firstName} ${rbt.lastName}\nPhone: ${rbt.phoneNumber}\nEmail: ${rbt.email ?? '—'}`
    try {
      await navigator.clipboard.writeText(text)
      setCopyFeedbackId(id)
      setTimeout(() => setCopyFeedbackId(null), 2000)
    } catch (e) {
      console.error(e)
    }
  }

  function openAssignModal(rbtProfileId: string) {
    setAssignModalRbtId(rbtProfileId)
    setAssignModalClientId('')
    setAssignModalDays([])
    setAssignModalTimeStart('')
    setAssignModalTimeEnd('')
    setAssignModalNotes('')
  }

  async function submitAssignModal(e: React.FormEvent) {
    e.preventDefault()
    if (!assignModalRbtId || assignModalDays.length === 0) return
    setAssignModalSubmitting(true)
    try {
      const body: {
        rbtProfileId: string
        daysOfWeek: number[]
        timeStart?: string
        timeEnd?: string
        notes?: string
        clientId?: string
        client?: { name: string; addressLine1?: string; city?: string; state?: string; zip?: string }
      } = {
        rbtProfileId: assignModalRbtId,
        daysOfWeek: assignModalDays,
        timeStart: assignModalTimeStart.trim() || undefined,
        timeEnd: assignModalTimeEnd.trim() || undefined,
        notes: assignModalNotes.trim() || undefined,
      }
      if (assignModalClientId) {
        body.clientId = assignModalClientId
      } else {
        body.client = {
          name: proxClientName || 'Client',
          addressLine1: proxAddress || undefined,
          city: proxCity || undefined,
          state: proxState || undefined,
          zip: proxZip || undefined,
        }
      }
      const res = await fetch('/api/admin/scheduling-beta/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to create assignment')
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
      setAssignModalRbtId(null)
      await fetchClients()
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Failed to add assignment')
    } finally {
      setAssignModalSubmitting(false)
    }
  }

  const [clientsLoading, setClientsLoading] = useState(false)

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) return
    setClientsLoading(true)
    try {
      const res = await fetch('/api/admin/scheduling-beta/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formName.trim(),
          addressLine1: formAddress.trim() || undefined,
          city: formCity.trim() || undefined,
          state: formState.trim() || 'NY',
          zip: formZip.trim() || undefined,
          preferredRbtEthnicity: formEthnicity === '__none__' ? undefined : formEthnicity,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create client')
      }
      await fetchClients()
      setFormName('')
      setFormAddress('')
      setFormCity('')
      setFormState('NY')
      setFormZip('')
      setFormEthnicity('__none__')
    } catch (err) {
      console.error(err)
      alert((err as Error).message || 'Failed to add client')
    } finally {
      setClientsLoading(false)
    }
  }

  async function deleteClient(clientId: string) {
    if (!confirm('Remove this client? Any assignments to them will also be removed.')) return
    try {
      const res = await fetch(`/api/admin/scheduling-beta/clients/${clientId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to delete')
      await fetchClients()
      setMatchResults((prev) => {
        const next = { ...prev }
        delete next[clientId]
        return next
      })
    } catch (e) {
      console.error(e)
      alert('Failed to remove client')
    }
  }

  function findClosestSix(client: Client): MatchResult[] {
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
    return withDistance.slice(0, 6)
  }

  function handleFindClosest(clientId: string) {
    const client = clients.find((c) => c.id === clientId)
    if (!client) return
    const top6 = findClosestSix(client)
    setMatchResults((prev) => ({ ...prev, [clientId]: top6 }))
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
          clientId: assignClientId,
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

  return (
    <>
      <div className="space-y-6">
      {/* Find Nearest RBTs — Proximity finder */}
      <Card className="border border-gray-200 dark:border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle className="text-lg">Find Nearest RBTs</CardTitle>
          <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">Enter a client address to find the closest available RBTs by driving distance.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search row — full width */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px]">
              <Label htmlFor="prox-client-name">Client name (optional)</Label>
              <Input
                id="prox-client-name"
                value={proxClientName}
                onChange={(e) => setProxClientName(e.target.value)}
                placeholder="For reference"
                className="mt-1"
              />
            </div>
            <div className="flex-1 min-w-[240px]">
              <AddressAutocomplete
                onAddressSelect={(address) => {
                  setProxAddress(address.addressLine1)
                  setProxCity(address.city)
                  setProxState(address.state || '')
                  setProxZip(address.zipCode)
                }}
                placeholder="Search client address..."
                id="prox-address"
                label="Client address"
              />
            </div>
            {(proxCity || proxState || proxZip) && (
              <div className="flex flex-wrap gap-2 items-center">
                {proxCity && <Badge variant="secondary">{proxCity}</Badge>}
                {proxState && <Badge variant="secondary">{proxState}</Badge>}
                {proxZip && <Badge variant="secondary">{proxZip}</Badge>}
              </div>
            )}
            <Button
              type="button"
              onClick={runProximitySearch}
              disabled={proxLoading}
              className="bg-orange-500 hover:bg-orange-600 text-white shrink-0"
            >
              {proxLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Calculating...
                </>
              ) : (
                'Find Nearest RBTs'
              )}
            </Button>
          </div>

          {/* Map — full width, large */}
          <div className="w-full">
            <SchedulingBetaProximityMap
              clientLat={proxResult?.clientLat ?? null}
              clientLng={proxResult?.clientLng ?? null}
              clientAddress={[proxAddress, proxCity, proxState, proxZip].filter(Boolean).join(', ')}
              rbts={proxResult?.rbts ?? []}
              hoveredRbtIndex={proxHoveredRbtIndex}
              selectedRbtIndex={proxSelectedRbtIndex}
            />
          </div>

          {/* Results — full width below map */}
          <div>
            {proxError && (
              <p className="text-sm text-amber-600 dark:text-amber-500">{proxError}</p>
            )}
            {proxResult && proxResult.rbts.length === 0 && !proxError && (
              <p className="text-sm text-gray-500">No hired RBTs found within 30 miles of this address. Try a different location.</p>
            )}
            {proxResult && proxResult.excludedCount != null && proxResult.excludedCount > 0 && (
              <p className="text-xs text-gray-500 mb-2">{proxResult.excludedCount} hired RBTs could not be included — missing location data. Run Geocode All to fix.</p>
            )}
            {proxResult && proxResult.rbts.length > 0 && (
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {proxResult.rbts.map((rbt, idx) => {
                  const rank = idx + 1
                  const rankColor = rank === 1 ? 'bg-green-500' : rank === 2 ? 'bg-blue-500' : rank === 3 ? 'bg-orange-500' : rank === 4 ? 'bg-purple-500' : rank === 5 ? 'bg-gray-500' : 'bg-teal-500'
                  const rankLabel = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`
                  return (
                    <li
                      key={rbt.rbtProfileId}
                      className={`p-4 rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)] shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md ${
                        fadingOutResultIds[rbt.rbtProfileId] ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'
                      }`}
                      onMouseEnter={() => setProxHoveredRbtIndex(idx)}
                      onMouseLeave={() => setProxHoveredRbtIndex(null)}
                      onClick={() => setProxSelectedRbtIndex(idx)}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold ${rankColor}`}>{rankLabel}</span>
                          <span className="font-bold text-gray-900 dark:text-[var(--text-primary)]">{rbt.firstName} {rbt.lastName}</span>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                        {formatDrivingDistance(rbt.drivingDistanceMiles) && <span>{formatDrivingDistance(rbt.drivingDistanceMiles)}</span>}
                        {formatDrivingTime(rbt.drivingDurationMinutes) && <span className={formatDrivingDistance(rbt.drivingDistanceMiles) ? 'ml-2' : ''}>{formatDrivingTime(rbt.drivingDurationMinutes)}</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{rbt.fullAddress ? (rbt.fullAddress.includes(',') ? rbt.fullAddress.split(',').slice(1).join(',').trim() : rbt.fullAddress) : '—'}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {rbt.transportation ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Has Car</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">No Car</Badge>
                        )}
                      </div>
                      {Array.isArray(rbt.languagesJson) && (rbt.languagesJson as string[]).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(rbt.languagesJson as string[]).map((lang) => (
                            <Badge key={lang} variant="outline" className="text-xs">{lang}</Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {DAYS_OF_WEEK.map((d) => (
                          <span
                            key={d.value}
                            className={`inline-flex items-center justify-center w-9 h-6 rounded text-xs ${rbt.availabilityDayOfWeeks?.includes(d.value) ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'}`}
                          >
                            {d.label}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                        <Button type="button" variant="outline" size="sm" onClick={() => copyContact(rbt, rbt.rbtProfileId)}>
                          {copyFeedbackId === rbt.rbtProfileId ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                          {copyFeedbackId === rbt.rbtProfileId ? 'Copied!' : 'Copy Contact Info'}
                        </Button>
                        <Button type="button" variant="outline" size="sm" asChild>
                          <Link href={`/admin/rbts/${rbt.rbtProfileId}`}>View Profile</Link>
                        </Button>
                        <Button type="button" variant="default" size="sm" onClick={() => openAssignModal(rbt.rbtProfileId)}>
                          Assign to Client
                        </Button>
                        <div className="relative">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-gray-600"
                            onClick={() => {
                              setExcludePopoverForId((prev) => (prev === rbt.rbtProfileId ? null : rbt.rbtProfileId))
                              setExcludeReason('')
                              setExcludeExpiryPreset('1m')
                            }}
                          >
                            <Ban className="w-4 h-4 mr-1" />
                            Exclude
                          </Button>
                          {excludePopoverForId === rbt.rbtProfileId && (
                            <div className="absolute right-0 mt-2 z-20 w-72 rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)] p-3 shadow-lg">
                              <p className="font-medium text-sm text-gray-900 dark:text-[var(--text-primary)]">
                                {rbt.firstName} {rbt.lastName}
                              </p>
                              <Input
                                value={excludeReason}
                                onChange={(e) => setExcludeReason(e.target.value)}
                                placeholder="Reason (optional)"
                                className="mt-2"
                              />
                              <div className="mt-3 space-y-1 text-sm">
                                <label className="flex items-center gap-2"><input type="radio" checked={excludeExpiryPreset === '2w'} onChange={() => setExcludeExpiryPreset('2w')} /> 2 weeks</label>
                                <label className="flex items-center gap-2"><input type="radio" checked={excludeExpiryPreset === '1m'} onChange={() => setExcludeExpiryPreset('1m')} /> 1 month</label>
                                <label className="flex items-center gap-2"><input type="radio" checked={excludeExpiryPreset === '3m'} onChange={() => setExcludeExpiryPreset('3m')} /> 3 months</label>
                                <label className="flex items-center gap-2"><input type="radio" checked={excludeExpiryPreset === 'none'} onChange={() => setExcludeExpiryPreset('none')} /> No expiry (manual restore only)</label>
                              </div>
                              <div className="mt-3 flex items-center gap-3">
                                <Button
                                  type="button"
                                  size="sm"
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                  disabled={excludingId === rbt.rbtProfileId}
                                  onClick={() => excludeRbtFromResults(rbt)}
                                >
                                  {excludingId === rbt.rbtProfileId ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                                  Exclude from Results
                                </Button>
                                <button
                                  type="button"
                                  className="text-sm text-gray-500 hover:underline"
                                  onClick={() => setExcludePopoverForId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {proxResult && (proxResult.activeExcludedCount ?? 0) > 0 && (
              <p className="mt-3 text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                {proxResult.activeExcludedCount} RBTs excluded from these results.{' '}
                <button
                  type="button"
                  className="text-orange-600 dark:text-[var(--orange-primary)] hover:underline"
                  onClick={() => {
                    setExcludedPanelOpen(true)
                    document.getElementById('excluded-rbts-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  Manage exclusions ↓
                </button>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card id="excluded-rbts-panel" className="border border-gray-200 dark:border-[var(--border-subtle)]">
        <CardHeader>
          <button
            type="button"
            onClick={() => setExcludedPanelOpen((v) => !v)}
            className="w-full flex items-center justify-between text-left"
          >
            <CardTitle className="text-lg">Excluded from Results ({exclusions.length})</CardTitle>
            <span className="inline-flex items-center gap-2 text-sm text-gray-500">
              <Badge variant="secondary">{exclusions.length}</Badge>
              {excludedPanelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>
        </CardHeader>
        {excludedPanelOpen && (
          <CardContent>
            {exclusions.length === 0 ? (
              <p className="text-sm text-gray-500">No RBTs currently excluded from results</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-[var(--border-subtle)] text-left">
                      <th className="py-2 pr-3">RBT Name</th>
                      <th className="py-2 pr-3">Reason</th>
                      <th className="py-2 pr-3">Excluded by</th>
                      <th className="py-2 pr-3">Excluded on</th>
                      <th className="py-2 pr-3">Expires</th>
                      <th className="py-2 pr-3">Time remaining</th>
                      <th className="py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exclusions.map((exclusion) => {
                      const remaining = timeRemainingLabel(exclusion.expiresAt)
                      return (
                        <tr
                          key={exclusion.id}
                          className={`border-b border-gray-100 dark:border-[var(--border-subtle)] transition-all duration-200 ${
                            fadingOutExclusionIds[exclusion.id] ? 'opacity-0 scale-[0.99]' : 'opacity-100 scale-100'
                          }`}
                        >
                          <td className="py-2 pr-3">
                            <Link href={`/admin/rbts/${exclusion.rbtProfileId}`} className="text-orange-600 dark:text-[var(--orange-primary)] hover:underline">
                              {exclusion.rbtProfile.firstName} {exclusion.rbtProfile.lastName}
                            </Link>
                          </td>
                          <td className="py-2 pr-3">{exclusion.reason?.trim() || '—'}</td>
                          <td className="py-2 pr-3">{exclusion.excludedBy.name || exclusion.excludedBy.email || '—'}</td>
                          <td className="py-2 pr-3">{formatDateShort(exclusion.createdAt)}</td>
                          <td className="py-2 pr-3">{formatDateShort(exclusion.expiresAt)}</td>
                          <td className={`py-2 pr-3 ${remaining.expired ? 'text-red-600' : ''}`}>{remaining.label}</td>
                          <td className="py-2">
                            {restoreConfirmId === exclusion.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-600">Restore {exclusion.rbtProfile.firstName} to proximity results?</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={restoringId === exclusion.id}
                                  onClick={() => restoreExclusion(exclusion)}
                                >
                                  Confirm
                                </Button>
                                <button type="button" className="text-xs text-gray-500 hover:underline" onClick={() => setRestoreConfirmId(null)}>
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <Button type="button" size="sm" variant="outline" onClick={() => setRestoreConfirmId(exclusion.id)}>
                                Restore
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* RBT Location Data — Geocode utility */}
      <Card className="border border-gray-200 dark:border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle className="text-lg">RBT Location Data</CardTitle>
          <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">
            {geocodeStats != null ? `${geocodeStats.withCoords} of ${geocodeStats.totalHired} hired RBTs have location data stored` : 'Loading…'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {geocodeStats != null && geocodeStats.totalHired > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Geocoded</span>
                <span>{Math.round((geocodeStats.withCoords / geocodeStats.totalHired) * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all"
                  style={{ width: `${(geocodeStats.withCoords / geocodeStats.totalHired) * 100}%` }}
                />
              </div>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            className="border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
            onClick={runGeocodeAll}
            disabled={geocodeLoading}
          >
            {geocodeLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Geocoding...
              </>
            ) : (
              'Geocode All RBT Addresses'
            )}
          </Button>
          {geocodeMessage && (
            <div className="text-sm">
              <p className="text-green-600 dark:text-green-500">{geocodeMessage.success}</p>
              {geocodeMessage.failedNames && geocodeMessage.failedNames.length > 0 && (
                <p className="mt-2 text-gray-500">Failed: {geocodeMessage.failedNames.join(', ')}</p>
              )}
            </div>
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
              Add client (saved to database)
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
                <AddressAutocomplete
                  onAddressSelect={(address) => {
                    setFormAddress(address.addressLine1)
                    setFormCity(address.city)
                    setFormState(address.state || 'NY')
                    setFormZip(address.zipCode)
                  }}
                  placeholder="Search address to auto-fill..."
                  id="client-address-search"
                  label="Search address (optional)"
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
                <Button type="submit" disabled={clientsLoading}>
                  {clientsLoading ? 'Saving…' : 'Add client'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Client list + Find 6 closest */}
        <Card className="border border-gray-200 dark:border-[var(--border-subtle)]">
          <CardHeader>
            <CardTitle className="text-lg">Clients</CardTitle>
            <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">Saved in database. Assign an RBT later with “Find 6 closest” then “Assign” below.</p>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <p className="text-sm text-gray-500">Add a client above (they are saved and persist after refresh).</p>
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
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleFindClosest(client.id)}
                        >
                          <MapPin className="w-4 h-4 mr-1" />
                          Find 6 closest RBTs
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => deleteClient(client.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {matchResults[client.id] && matchResults[client.id].length > 0 && (
                      <div className="mt-3 pl-2 border-l-2 border-primary">
                        <p className="text-xs font-medium text-gray-600 dark:text-[var(--text-tertiary)] mb-1">
                          Top 6 matches:
                        </p>
                        <ul className="text-sm space-y-2">
                          {matchResults[client.id].map((m, i) => (
                            <li key={m.rbt.id} className="flex flex-wrap items-center gap-2">
                              <span>
                                {i + 1}. {m.rbt.fullName} — {m.distanceMiles} mi
                                {m.rbt.ethnicity && ` (${m.rbt.ethnicity})`}
                              </span>
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

    <Dialog open={!!assignModalRbtId} onOpenChange={(open) => !open && setAssignModalRbtId(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign RBT to Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={submitAssignModal} className="space-y-4">
          <div>
            <Label>Client</Label>
            <Select value={assignModalClientId || '__new__'} onValueChange={(v) => setAssignModalClientId(v === '__new__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select or create new" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__new__">New client: {proxClientName || 'Client'}</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Days of week *</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {DAYS_OF_WEEK.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setAssignModalDays((prev) => prev.includes(d.value) ? prev.filter((x) => x !== d.value) : [...prev, d.value].sort((a, b) => a - b))}
                  className={`inline-flex items-center justify-center w-10 h-8 rounded text-sm border ${assignModalDays.includes(d.value) ? 'bg-primary text-primary-foreground border-primary' : 'border-input bg-background'}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Time start</Label>
              <Input value={assignModalTimeStart} onChange={(e) => setAssignModalTimeStart(e.target.value)} placeholder="16:00" />
            </div>
            <div>
              <Label>Time end</Label>
              <Input value={assignModalTimeEnd} onChange={(e) => setAssignModalTimeEnd(e.target.value)} placeholder="19:00" />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <textarea value={assignModalNotes} onChange={(e) => setAssignModalNotes(e.target.value)} className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignModalRbtId(null)}>Cancel</Button>
            <Button type="submit" disabled={assignModalSubmitting || assignModalDays.length === 0}>
              {assignModalSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Assign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}
