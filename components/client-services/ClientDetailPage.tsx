'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Phone,
  Mail,
  AlertTriangle,
  Check,
  Circle,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import BreakCountdown from '@/components/client-services/BreakCountdown'
import { parseActivityNote } from '@/lib/client-services/activityNote'
import {
  BOARD_BUCKET_LABELS,
  CS_ACCENT,
  initials,
  statusStyle,
} from '@/lib/client-services/uiTheme'
import type { ServiceBoardBucket } from '@/lib/client-services/serviceStatus'
import { NY_BOROUGHS } from '@/lib/client-services/constants'
import { cn } from '@/lib/utils'

type Doc = {
  id: string
  documentType: string
  label: string
  collected: boolean
  collectedAt: string | null
  collectedBy: string | null
}

type Note = {
  id: string
  content: string
  createdAt: string
  author: { id: string; name: string | null; email: string | null }
}

type StatusHist = {
  id: string
  fromStatus: string | null
  toStatus: string
  reason: string | null
  createdAt: string
  changedByUser: { id: string; name: string | null; email: string | null } | null
}

type Metrics = {
  scheduledHoursPerWeek: number
  authHours: number | null
  hoursGap: number | null
  needsAdditionalHours: boolean
  needsRbt: boolean
  notBeingServed: boolean
  receivingServices?: boolean
  scheduleLinked: boolean
  boardBucket: ServiceBoardBucket
  scheduleBtNames: string[]
  careTeamScheduleMismatch?: string[]
  period?: { start: string; end: string; label: string }
  activeClientBreak: {
    id: string
    expectedReturnDate: string
    daysUntilReturn: number
    overdue: boolean
    daysOverdue: number
    reason: string
  } | null
  activeRbtBreaks: {
    id: string
    btName?: string
    expectedReturnDate: string
    daysUntilReturn: number
    overdue: boolean
    daysOverdue: number
    hasCoverage?: boolean
  }[]
}

type Session = {
  id: string
  dayLabel: string
  startLabel: string
  endLabel: string
  hours: number
  btName: string
  location?: string | null
  periodStart: string | null
  periodEnd: string | null
}

type Client = {
  id: string
  clientCode: string
  firstName: string
  lastName: string
  status: string
  age: number | null
  dateOfBirth: string | null
  addressLine: string | null
  city: string | null
  borough: string | null
  state: string | null
  zip: string | null
  insuranceProvider: string | null
  insuranceId: string | null
  diagnosis: string | null
  parentName: string | null
  parentPhone: string | null
  parentEmail: string | null
  parentRelationship: string | null
  bcbaName: string | null
  caseCoordinatorName: string | null
  serviceStartDate: string | null
  serviceEndDate: string | null
  authLengthMonths: number | null
  authHours: number | null
  currentHoursPerWeek: number | null
  docsCollected: number
  docsTotal: number
  btAssignments: { id: string; btName: string; status: string }[]
  documents: Doc[]
  clientNotes: Note[]
  statusHistory?: StatusHist[]
  metrics?: Metrics
}

type EditForm = {
  firstName: string
  lastName: string
  status: string
  dateOfBirth: string
  borough: string
  insuranceProvider: string
  insuranceId: string
  diagnosis: string
  parentName: string
  parentPhone: string
  parentEmail: string
  parentRelationship: string
  bcbaName: string
  caseCoordinatorName: string
  serviceStartDate: string
  serviceEndDate: string
  authHours: string
  addressLine: string
  city: string
  state: string
  zip: string
}

function dateInput(v: string | null | undefined) {
  if (!v) return ''
  return String(v).slice(0, 10)
}

export default function ClientDetailPage({
  clientId,
  canEditPhi,
}: {
  clientId: string
  canEditPhi: boolean
}) {
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [error, setError] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteDetails, setNoteDetails] = useState('')
  const [btList, setBtList] = useState<string[]>([])
  const [newBt, setNewBt] = useState('')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [notesOpen, setNotesOpen] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [expandedNoteIds, setExpandedNoteIds] = useState<Record<string, boolean>>({})

  const [showClientBreak, setShowClientBreak] = useState(false)
  const [showRbtBreak, setShowRbtBreak] = useState(false)
  const [breakReason, setBreakReason] = useState('VACATION')
  const [breakStart, setBreakStart] = useState('')
  const [breakNotes, setBreakNotes] = useState('')
  const [rbtBreakName, setRbtBreakName] = useState('')
  const [rbtHasCoverage, setRbtHasCoverage] = useState(false)
  const [rbtCoverageNotes, setRbtCoverageNotes] = useState('')
  const [unlinkedNames, setUnlinkedNames] = useState<string[]>([])
  const [linkPick, setLinkPick] = useState('')
  const [linkPeriodLabel, setLinkPeriodLabel] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
  const [showLinkUi, setShowLinkUi] = useState(false)
  const [linkError, setLinkError] = useState('')
  const [showManualSchedule, setShowManualSchedule] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualBt, setManualBt] = useState('')
  const [manualStart, setManualStart] = useState('15:00')
  const [manualEnd, setManualEnd] = useState('19:00')
  const [manualDays, setManualDays] = useState<number[]>([1, 2, 3, 4, 5])

  const load = async () => {
    setError('')
    const [res, schedRes] = await Promise.all([
      fetch(`/api/client-services/clients/${clientId}`, { credentials: 'include' }),
      fetch(`/api/client-services/clients/${clientId}/schedule`, { credentials: 'include' }),
    ])
    if (res.status === 403) {
      setError('Access denied — outside your caseload')
      return
    }
    if (!res.ok) {
      setError('Failed to load client')
      return
    }
    const data = await res.json()
    const c = data.client as Client
    setClient(c)
    setBtList(
      c.btAssignments.filter((b) => b.status === 'ACTIVE').map((b) => b.btName)
    )
    if (schedRes.ok) {
      const sched = await schedRes.json()
      setSessions(sched.sessions ?? [])
      if (sched.metrics) setClient({ ...c, metrics: sched.metrics })
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  const startEdit = () => {
    if (!client || !canEditPhi) return
    setForm({
      firstName: client.firstName,
      lastName: client.lastName,
      status: client.status,
      dateOfBirth: dateInput(client.dateOfBirth),
      borough: client.borough || '',
      insuranceProvider: client.insuranceProvider || '',
      insuranceId: client.insuranceId || '',
      diagnosis: client.diagnosis || '',
      parentName: client.parentName || '',
      parentPhone: client.parentPhone || '',
      parentEmail: client.parentEmail || '',
      parentRelationship: client.parentRelationship || '',
      bcbaName: client.bcbaName || '',
      caseCoordinatorName: client.caseCoordinatorName || '',
      serviceStartDate: dateInput(client.serviceStartDate),
      serviceEndDate: dateInput(client.serviceEndDate),
      authHours: client.authHours != null ? String(client.authHours) : '',
      addressLine: client.addressLine || '',
      city: client.city || '',
      state: client.state || '',
      zip: client.zip || '',
    })
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!form) return
    setSaving(true)
    try {
      const res = await fetch(`/api/client-services/clients/${clientId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          authHours: form.authHours === '' ? null : Number(form.authHours),
          dateOfBirth: form.dateOfBirth || null,
          serviceStartDate: form.serviceStartDate || null,
          serviceEndDate: form.serviceEndDate || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Save failed')
        return
      }
      // Also sync care team names from edit form
      await fetch(`/api/client-services/clients/${clientId}/care-team`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bcbaName: form.bcbaName,
          caseCoordinatorName: form.caseCoordinatorName,
          btNames: btList,
        }),
      })
      setEditing(false)
      setForm(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const saveCareTeam = async (names: string[]) => {
    setBtList(names)
    await fetch(`/api/client-services/clients/${clientId}/care-team`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bcbaName: editing && form ? form.bcbaName : client?.bcbaName,
        caseCoordinatorName:
          editing && form ? form.caseCoordinatorName : client?.caseCoordinatorName,
        btNames: names,
      }),
    })
    await load()
  }

  const toggleDoc = async (doc: Doc, collected: boolean) => {
    await fetch(`/api/client-services/clients/${clientId}/documents`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: doc.id, collected }),
    })
    await load()
  }

  const uploadDoc = async (doc: Doc, file: File | null) => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    await fetch(`/api/client-services/clients/${clientId}/documents/${doc.id}/upload`, {
      method: 'POST',
      credentials: 'include',
      body: fd,
    })
    await load()
  }

  const addNote = async () => {
    if (!noteTitle.trim() && !noteDetails.trim()) return
    await fetch(`/api/client-services/clients/${clientId}/notes`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: noteTitle.trim() || 'Note',
        details: noteDetails.trim() || null,
      }),
    })
    setNoteTitle('')
    setNoteDetails('')
    await load()
  }

  const createBreak = async (type: 'client' | 'rbt') => {
    const body: Record<string, unknown> = {
      type,
      reason: breakReason,
      startDate: breakStart,
      notes: breakNotes || null,
    }
    if (type === 'rbt') {
      body.btName = rbtBreakName
      body.hasCoverage = rbtHasCoverage
      body.coverageNotes = rbtCoverageNotes || null
    }
    const res = await fetch(`/api/client-services/clients/${clientId}/breaks`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Failed to create break')
      return
    }
    setShowClientBreak(false)
    setShowRbtBreak(false)
    setBreakNotes('')
    await load()
  }

  const markReturned = async (breakId: string, breakType: 'client' | 'rbt') => {
    await fetch(`/api/client-services/clients/${clientId}/breaks`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ breakId, breakType, action: 'return' }),
    })
    await load()
  }

  const deleteClient = async () => {
    if (!client || !canEditPhi || deleting) return
    const label = `${client.firstName} ${client.lastName}`.trim()
    const ok = window.confirm(
      `Delete ${label} (${client.clientCode}) permanently?\n\nThis cannot be undone. Schedule links will be unlinked; notes, documents, and breaks for this client will be removed.`
    )
    if (!ok) return
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/client-services/clients/${clientId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to delete client')
        return
      }
      router.push('/client-services')
      router.refresh()
    } catch {
      setError('Failed to delete client')
    } finally {
      setDeleting(false)
    }
  }

  const loadUnlinked = async () => {
    setShowLinkUi(true)
    setLinkBusy(true)
    setLinkError('')
    try {
      const prefer = client
        ? `${client.firstName} ${client.lastName}`.trim()
        : ''
      const params = new URLSearchParams()
      if (prefer) {
        params.set('prefer', prefer)
        params.set('q', prefer)
      }
      const res = await fetch(`/api/client-services/schedule-links?${params}`, {
        credentials: 'include',
      })
      if (!res.ok) return
      const data = await res.json()
      const names: string[] = (data.unlinked ?? []).map(
        (u: { clientName: string }) => u.clientName
      )
      setUnlinkedNames(names)
      setLinkPeriodLabel(data.schedulePeriod?.label ?? '')
      const exact = prefer
        ? names.find((n) => n.toLowerCase() === prefer.toLowerCase())
        : undefined
      const fuzzy = prefer
        ? names.find((n) => {
            const nl = n.toLowerCase()
            const parts = prefer.toLowerCase().split(/\s+/).filter(Boolean)
            return parts.every((p) => nl.includes(p))
          })
        : undefined
      setLinkPick(exact || fuzzy || prefer || '')
      if (!manualName && prefer) setManualName(prefer)
    } finally {
      setLinkBusy(false)
    }
  }

  const linkSchedule = async () => {
    if (!linkPick.trim()) return
    setLinkBusy(true)
    setLinkError('')
    try {
      const res = await fetch('/api/client-services/schedule-links', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link',
          scheduleClientName: linkPick.trim(),
          serviceClientId: clientId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLinkError(data.error || 'Link failed')
        setShowManualSchedule(true)
        if (!manualName) setManualName(linkPick.trim())
        return
      }
      setLinkPick('')
      setShowLinkUi(false)
      setShowManualSchedule(false)
      await load()
    } catch {
      setLinkError('Link failed')
    } finally {
      setLinkBusy(false)
    }
  }

  const createManualSchedule = async () => {
    if (!manualName.trim() || !manualBt.trim() || manualDays.length === 0) return
    setLinkBusy(true)
    setLinkError('')
    try {
      const res = await fetch('/api/client-services/schedule-links', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-manual',
          serviceClientId: clientId,
          scheduleClientName: manualName.trim(),
          btName: manualBt.trim(),
          days: manualDays,
          startTime: manualStart,
          endTime: manualEnd,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLinkError(data.error || 'Could not create schedule sessions')
        return
      }
      setShowManualSchedule(false)
      setShowLinkUi(false)
      await load()
    } catch {
      setLinkError('Could not create schedule sessions')
    } finally {
      setLinkBusy(false)
    }
  }

  const toggleManualDay = (day: number) => {
    setManualDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  if (error && !client) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm" style={{ color: '#A32D2D' }}>{error}</p>
      </div>
    )
  }

  if (!client) {
    return <p className="text-sm text-[#5F6B7A]">Loading…</p>
  }

  const m = client.metrics
  const bucket = m?.boardBucket || 'ON_HOLD_DISCHARGED'
  const st = statusStyle(bucket)
  const auth = m?.authHours ?? client.authHours
  const sched = m?.scheduledHoursPerWeek ?? 0
  const pct = auth && auth > 0 ? Math.min(100, Math.round((sched / auth) * 100)) : 0
  const gap =
    m?.scheduleLinked && m?.hoursGap != null && m.hoursGap > 0
      ? m.hoursGap
      : m?.scheduleLinked && auth != null
        ? Math.max(0, auth - sched)
        : null
  const under = !!m?.needsAdditionalHours

  const end = client.serviceEndDate ? new Date(client.serviceEndDate) : null
  const daysToExpiry =
    end != null ? Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
  const authWarn = daysToExpiry != null && daysToExpiry >= 0 && daysToExpiry <= 30

  const f = form
  const display = {
    firstName: editing && f ? f.firstName : client.firstName,
    lastName: editing && f ? f.lastName : client.lastName,
    status: editing && f ? f.status : client.status,
    borough: editing && f ? f.borough : client.borough,
    bcbaName: editing && f ? f.bcbaName : client.bcbaName,
    caseCoordinatorName: editing && f ? f.caseCoordinatorName : client.caseCoordinatorName,
    insuranceProvider: editing && f ? f.insuranceProvider : client.insuranceProvider,
    insuranceId: editing && f ? f.insuranceId : client.insuranceId,
    parentName: editing && f ? f.parentName : client.parentName,
    parentPhone: editing && f ? f.parentPhone : client.parentPhone,
    parentEmail: editing && f ? f.parentEmail : client.parentEmail,
    parentRelationship: editing && f ? f.parentRelationship : client.parentRelationship,
    authHours: editing && f ? f.authHours : client.authHours != null ? String(client.authHours) : '',
    serviceEndDate: editing && f ? f.serviceEndDate : dateInput(client.serviceEndDate),
    dateOfBirth: editing && f ? f.dateOfBirth : dateInput(client.dateOfBirth),
  }

  const btOptions = [...new Set([...btList, ...(m?.scheduleBtNames ?? [])])]

  return (
    <div className="space-y-5 max-w-5xl">
      <BackLink />

      {error && <p className="text-sm" style={{ color: '#A32D2D' }}>{error}</p>}

      {/* Header card */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-base font-semibold shrink-0"
              style={{ backgroundColor: st.bg, color: st.text }}
            >
              {initials(display.firstName, display.lastName)}
            </div>
            <div className="min-w-0">
              {editing && f ? (
                <div className="flex flex-wrap gap-2 mb-2">
                  <input
                    className={inputCls}
                    value={f.firstName}
                    onChange={(e) => setForm({ ...f, firstName: e.target.value })}
                    placeholder="First"
                  />
                  <input
                    className={inputCls}
                    value={f.lastName}
                    onChange={(e) => setForm({ ...f, lastName: e.target.value })}
                    placeholder="Last"
                  />
                  <select
                    className={inputCls}
                    value={f.status}
                    onChange={(e) => setForm({ ...f, status: e.target.value })}
                  >
                    <option value="NEW">New</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ON_HOLD">On hold</option>
                    <option value="DISCHARGED">Discharged</option>
                  </select>
                </div>
              ) : (
                <h2 className="text-xl font-semibold text-[#1a1d21]">
                  {display.firstName} {display.lastName}
                </h2>
              )}
              <div className="flex flex-wrap gap-2 mt-1.5">
                <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-[#F1F3F5] text-[#5F6B7A]">
                  {display.status}
                </span>
                <span
                  className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: st.bg, color: st.text }}
                >
                  {BOARD_BUCKET_LABELS[bucket]}
                </span>
              </div>
              <div className="text-xs text-[#5F6B7A] mt-2 flex flex-wrap gap-x-2">
                <span>{client.clientCode}</span>
                {client.age != null && <span>· Age {client.age}</span>}
                {editing && f ? (
                  <input
                    type="date"
                    className={inputCls + ' ml-1'}
                    value={f.dateOfBirth}
                    onChange={(e) => setForm({ ...f, dateOfBirth: e.target.value })}
                  />
                ) : (
                  display.dateOfBirth && (
                    <span>· DOB {new Date(display.dateOfBirth + 'T12:00:00').toLocaleDateString()}</span>
                  )
                )}
                {editing && f ? (
                  <select
                    className={inputCls}
                    value={f.borough}
                    onChange={(e) => setForm({ ...f, borough: e.target.value })}
                  >
                    <option value="">Borough</option>
                    {NY_BOROUGHS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                ) : (
                  display.borough && <span>· {display.borough}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {editing ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[#5F6B7A]"
                  onClick={() => {
                    setEditing(false)
                    setForm(null)
                  }}
                >
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
                <Button
                  size="sm"
                  className="text-white"
                  style={{ backgroundColor: CS_ACCENT.solid }}
                  disabled={saving}
                  onClick={saveEdit}
                >
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </>
            ) : canEditPhi ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[#E5E7EB] text-[#5F6B7A]"
                  onClick={startEdit}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={deleting}
                  onClick={deleteClient}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  {deleting ? 'Deleting…' : 'Delete client'}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Alerts */}
      {m?.needsRbt && (
        <Alert tone="red">No BT assigned — needs an RBT</Alert>
      )}
      {m?.notBeingServed && m?.scheduleLinked && !m?.activeClientBreak && (
        <Alert tone="red">Not currently being served — no scheduled sessions this period</Alert>
      )}
      {!m?.scheduleLinked && client?.status === 'ACTIVE' && (
        <Alert tone="amber">
          Not linked to schedule — link a schedule name so hours and status derive correctly
        </Alert>
      )}
      {m?.careTeamScheduleMismatch && m.careTeamScheduleMismatch.length > 0 && (
        <Alert tone="amber">
          Schedule / care-team mismatch: {m.careTeamScheduleMismatch.join(', ')} on schedule
          but not on care team
        </Alert>
      )}
      {under && gap != null && gap > 0 && (
        <Alert tone="amber">
          {gap} hrs open — needs more sessions ({sched} / {auth} authorized)
        </Alert>
      )}
      {authWarn && (
        <Alert tone="amber">Authorization expires in {daysToExpiry} days</Alert>
      )}

      {/* Care team + Hours */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Care team">
          <Field label="BCBA">
            {editing && f ? (
              <input
                className={inputCls}
                value={f.bcbaName}
                onChange={(e) => setForm({ ...f, bcbaName: e.target.value })}
              />
            ) : (
              <span>{display.bcbaName || '—'}</span>
            )}
          </Field>
          <Field label="Coordinator">
            {editing && f ? (
              <input
                className={inputCls}
                value={f.caseCoordinatorName}
                onChange={(e) => setForm({ ...f, caseCoordinatorName: e.target.value })}
              />
            ) : (
              <span>{display.caseCoordinatorName || '—'}</span>
            )}
          </Field>
          <Field label="Assigned BTs">
            {btList.length === 0 ? (
              <span className="font-medium" style={{ color: '#A32D2D' }}>
                No BT assigned
              </span>
            ) : (
              <ul className="space-y-1">
                {btList.map((name) => (
                  <li key={name} className="flex items-center justify-between gap-2 text-sm">
                    <span>{name}</span>
                    <button
                      type="button"
                      className="text-xs text-[#8B95A1] hover:text-[#A32D2D]"
                      onClick={() => saveCareTeam(btList.filter((n) => n !== name))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2 mt-2">
              <input
                className={inputCls + ' flex-1'}
                placeholder="BT name"
                value={newBt}
                onChange={(e) => setNewBt(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                className="border-[#E5E7EB]"
                disabled={!newBt.trim()}
                onClick={() => {
                  const n = newBt.trim()
                  if (!n) return
                  saveCareTeam([...btList, n])
                  setNewBt('')
                }}
              >
                Assign BT
              </Button>
            </div>
          </Field>
        </Card>

        <Card title="Hours & authorization">
          <div className="text-sm text-[#5F6B7A] mb-2">
            {sched}
            {auth != null ? ` / ${auth}` : ''} hrs scheduled
          </div>
          <div className="h-2 rounded-full bg-[#EEF0F2] overflow-hidden mb-2">
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                backgroundColor: under ? '#854F0B' : '#0F6E56',
              }}
            />
          </div>
          {under && gap != null && gap > 0 ? (
            <p className="text-sm font-medium mb-3" style={{ color: '#854F0B' }}>
              {gap} hrs open — needs more sessions
            </p>
          ) : (
            <p className="text-sm font-medium mb-3" style={{ color: '#0F6E56' }}>
              Full
            </p>
          )}
          <Field label="Authorized hours">
            {editing && f ? (
              <input
                type="number"
                className={inputCls}
                value={f.authHours}
                onChange={(e) => setForm({ ...f, authHours: e.target.value })}
              />
            ) : (
              <span>{auth ?? '—'}</span>
            )}
          </Field>
          <Field label="Auth end date">
            {editing && f ? (
              <input
                type="date"
                className={inputCls}
                value={f.serviceEndDate}
                onChange={(e) => setForm({ ...f, serviceEndDate: e.target.value })}
              />
            ) : (
              <span
                className={authWarn ? 'font-medium' : ''}
                style={authWarn ? { color: '#854F0B' } : undefined}
              >
                {display.serviceEndDate
                  ? new Date(display.serviceEndDate + 'T12:00:00').toLocaleDateString()
                  : '—'}
              </span>
            )}
          </Field>
          <Field label="Insurance">
            {editing && f ? (
              <div className="space-y-1.5">
                <input
                  className={inputCls}
                  placeholder="Provider"
                  value={f.insuranceProvider}
                  onChange={(e) => setForm({ ...f, insuranceProvider: e.target.value })}
                />
                <input
                  className={inputCls}
                  placeholder="Member ID"
                  value={f.insuranceId}
                  onChange={(e) => setForm({ ...f, insuranceId: e.target.value })}
                />
              </div>
            ) : (
              <span>
                {display.insuranceProvider || '—'}
                {display.insuranceId ? ` · ${display.insuranceId}` : ''}
              </span>
            )}
          </Field>
        </Card>
      </div>

      {/* Schedule */}
      <Card
        title="Schedule"
        subtitle={
          m?.period?.label
            ? `Period ${m.period.label} · Artemis · read-only`
            : 'From Artemis import · read-only'
        }
      >
        {!m?.scheduleLinked && (
          <div className="mb-3 space-y-2">
            <p className="text-sm text-[#854F0B]">
              Not linked to schedule assignments — not counted as unserved until linked.
            </p>
            {canEditPhi && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#E5E7EB] text-xs"
                    disabled={linkBusy}
                    onClick={loadUnlinked}
                  >
                    {linkBusy ? 'Loading…' : 'Link to schedule'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#E5E7EB] text-xs"
                    disabled={linkBusy}
                    onClick={() => {
                      setShowManualSchedule(true)
                      setShowLinkUi(true)
                      if (!manualName && client) {
                        setManualName(`${client.firstName} ${client.lastName}`.trim())
                      }
                    }}
                  >
                    Add schedule sessions
                  </Button>
                </div>
                {showLinkUi && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      className={inputCls + ' min-w-[12rem]'}
                      value={unlinkedNames.includes(linkPick) ? linkPick : ''}
                      onChange={(e) => setLinkPick(e.target.value)}
                    >
                      <option value="">Schedule name…</option>
                      {unlinkedNames.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <input
                      className={inputCls + ' min-w-[10rem]'}
                      list="cs-schedule-names"
                      placeholder="Or type schedule name"
                      value={linkPick}
                      onChange={(e) => setLinkPick(e.target.value)}
                    />
                    <datalist id="cs-schedule-names">
                      {unlinkedNames.map((n) => (
                        <option key={n} value={n} />
                      ))}
                    </datalist>
                    <Button
                      size="sm"
                      className="text-white text-xs"
                      style={{ backgroundColor: CS_ACCENT.solid }}
                      disabled={!linkPick.trim() || linkBusy}
                      onClick={linkSchedule}
                    >
                      Link
                    </Button>
                    {linkPeriodLabel && (
                      <span className="text-[11px] text-[#8B95A1]">
                        Period {linkPeriodLabel}
                        {unlinkedNames.length === 0
                          ? ' · no matching names — type it or add sessions below'
                          : ` · ${unlinkedNames.length} name(s)`}
                      </span>
                    )}
                  </div>
                )}
                {linkError && (
                  <p className="text-sm" style={{ color: '#A32D2D' }}>
                    {linkError}
                  </p>
                )}
                {showManualSchedule && (
                  <div className="rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] p-3 space-y-2">
                    <p className="text-xs font-medium text-[#5F6B7A]">
                      Add sessions manually (client name, BT, days, times)
                    </p>
                    <input
                      className={inputCls}
                      placeholder="Schedule client name (e.g. Inayah Irfan)"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                    />
                    <input
                      className={inputCls}
                      placeholder="BT / RBT name (e.g. Yan Suen Ho)"
                      value={manualBt}
                      onChange={(e) => setManualBt(e.target.value)}
                      list="cs-bt-options"
                    />
                    <datalist id="cs-bt-options">
                      {btOptions.map((n) => (
                        <option key={n} value={n} />
                      ))}
                    </datalist>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { d: 1, label: 'Mon' },
                        { d: 2, label: 'Tue' },
                        { d: 3, label: 'Wed' },
                        { d: 4, label: 'Thu' },
                        { d: 5, label: 'Fri' },
                        { d: 6, label: 'Sat' },
                        { d: 0, label: 'Sun' },
                      ].map(({ d, label }) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleManualDay(d)}
                          className={cn(
                            'rounded-md border px-2 py-1 text-xs font-medium',
                            manualDays.includes(d)
                              ? 'border-[#378ADD] bg-[#E6F1FB] text-[#185FA5]'
                              : 'border-[#E5E7EB] bg-white text-[#5F6B7A]'
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-[#5F6B7A]">
                        Start
                        <input
                          type="time"
                          className={inputCls + ' mt-1'}
                          value={manualStart}
                          onChange={(e) => setManualStart(e.target.value)}
                        />
                      </label>
                      <label className="text-xs text-[#5F6B7A]">
                        End
                        <input
                          type="time"
                          className={inputCls + ' mt-1'}
                          value={manualEnd}
                          onChange={(e) => setManualEnd(e.target.value)}
                        />
                      </label>
                    </div>
                    <Button
                      size="sm"
                      className="text-white text-xs"
                      style={{ backgroundColor: CS_ACCENT.solid }}
                      disabled={
                        linkBusy ||
                        !manualName.trim() ||
                        !manualBt.trim() ||
                        manualDays.length === 0
                      }
                      onClick={createManualSchedule}
                    >
                      {linkBusy ? 'Saving…' : 'Save sessions & link'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {sessions.length === 0 ? (
          <p className="text-sm text-[#5F6B7A]">No linked sessions this period.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sessions.map((s) => (
              <span
                key={s.id}
                className="inline-flex flex-col rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] px-3 py-2 text-xs"
              >
                <span className="font-medium text-[#1a1d21]">
                  {s.dayLabel} {s.startLabel}–{s.endLabel}
                </span>
                <span className="text-[#5F6B7A]">
                  {s.btName} · {s.hours}h
                  {s.location ? ` · ${s.location}` : ''}
                </span>
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Parent + Breaks */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Parent / guardian">
          <Field label="Name">
            {editing && f ? (
              <input
                className={inputCls}
                value={f.parentName}
                onChange={(e) => setForm({ ...f, parentName: e.target.value })}
              />
            ) : (
              <span className="font-medium text-[#1a1d21]">{display.parentName || '—'}</span>
            )}
          </Field>
          <Field label="Relationship">
            {editing && f ? (
              <input
                className={inputCls}
                value={f.parentRelationship}
                onChange={(e) => setForm({ ...f, parentRelationship: e.target.value })}
              />
            ) : (
              <span>{display.parentRelationship || '—'}</span>
            )}
          </Field>
          <Field label="Phone">
            {editing && f ? (
              <input
                className={inputCls}
                value={f.parentPhone}
                onChange={(e) => setForm({ ...f, parentPhone: e.target.value })}
              />
            ) : display.parentPhone ? (
              <a
                href={`tel:${display.parentPhone}`}
                className="inline-flex items-center gap-1.5"
                style={{ color: CS_ACCENT.text }}
              >
                <Phone className="w-3.5 h-3.5" />
                {display.parentPhone}
              </a>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Email">
            {editing && f ? (
              <input
                className={inputCls}
                value={f.parentEmail}
                onChange={(e) => setForm({ ...f, parentEmail: e.target.value })}
              />
            ) : display.parentEmail ? (
              <a
                href={`mailto:${display.parentEmail}`}
                className="inline-flex items-center gap-1.5"
                style={{ color: CS_ACCENT.text }}
              >
                <Mail className="w-3.5 h-3.5" />
                {display.parentEmail}
              </a>
            ) : (
              '—'
            )}
          </Field>
        </Card>

        <Card title="Breaks">
          {m?.activeClientBreak && (
            <div className="mb-3 space-y-1.5">
              <BreakCountdown
                label={`Client on break (${m.activeClientBreak.reason})`}
                hideReturn
              />
              <button
                type="button"
                className="text-xs font-medium"
                style={{ color: CS_ACCENT.text }}
                onClick={() => markReturned(m.activeClientBreak!.id, 'client')}
              >
                Mark returned
              </button>
            </div>
          )}
          {m?.activeRbtBreaks.map((b) => (
            <div key={b.id} className="mb-3 space-y-1.5">
              <BreakCountdown
                label={`RBT ${b.btName}${b.hasCoverage ? '' : ' — needs coverage'}`}
                hideReturn
              />
              <button
                type="button"
                className="text-xs font-medium"
                style={{ color: CS_ACCENT.text }}
                onClick={() => markReturned(b.id, 'rbt')}
              >
                Mark returned
              </button>
            </div>
          ))}
          {!m?.activeClientBreak && (!m?.activeRbtBreaks || m.activeRbtBreaks.length === 0) && (
            <p className="text-sm text-[#5F6B7A] mb-3">No active breaks.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-[#E5E7EB] text-xs"
              onClick={() => {
                setShowClientBreak((v) => !v)
                setShowRbtBreak(false)
              }}
            >
              Client break
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-[#E5E7EB] text-xs"
              onClick={() => {
                setShowRbtBreak((v) => !v)
                setShowClientBreak(false)
              }}
            >
              RBT break
            </Button>
          </div>
          {(showClientBreak || showRbtBreak) && (
            <div className="mt-3 space-y-2 rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] p-3">
              <select
                value={breakReason}
                onChange={(e) => setBreakReason(e.target.value)}
                className={inputCls}
              >
                <option value="VACATION">Vacation</option>
                <option value="MEDICAL">Medical</option>
                <option value="FAMILY">Family</option>
                <option value="OTHER">Other</option>
              </select>
              <label className="text-xs text-[#5F6B7A] block">
                Start
                <input
                  type="date"
                  value={breakStart}
                  onChange={(e) => setBreakStart(e.target.value)}
                  className={inputCls + ' mt-1'}
                />
              </label>
              {showRbtBreak && (
                <>
                  <select
                    value={rbtBreakName}
                    onChange={(e) => setRbtBreakName(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Which RBT…</option>
                    {btOptions.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  {!btOptions.length && (
                    <input
                      value={rbtBreakName}
                      onChange={(e) => setRbtBreakName(e.target.value)}
                      placeholder="BT name"
                      className={inputCls}
                    />
                  )}
                  <label className="flex items-center gap-2 text-sm text-[#5F6B7A]">
                    <input
                      type="checkbox"
                      checked={rbtHasCoverage}
                      onChange={(e) => setRbtHasCoverage(e.target.checked)}
                    />
                    Coverage arranged
                  </label>
                  <input
                    value={rbtCoverageNotes}
                    onChange={(e) => setRbtCoverageNotes(e.target.value)}
                    placeholder="Coverage notes"
                    className={inputCls}
                  />
                </>
              )}
              {showClientBreak && (
                <input
                  value={breakNotes}
                  onChange={(e) => setBreakNotes(e.target.value)}
                  placeholder="Additional notes (optional)"
                  className={inputCls}
                />
              )}
              <Button
                size="sm"
                className="text-white text-xs"
                style={{ backgroundColor: CS_ACCENT.solid }}
                disabled={!breakStart || (showRbtBreak && !rbtBreakName)}
                onClick={() => createBreak(showRbtBreak ? 'rbt' : 'client')}
              >
                Save break
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Documents */}
      <Card title={`Documents · ${client.docsCollected}/9 collected`}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {client.documents.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => toggleDoc(doc, !doc.collected)}
              className={cn(
                'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                doc.collected
                  ? 'border-[#B8E0D2] bg-[#E1F5EE]'
                  : 'border-[#E5E7EB] bg-[#F7F8FA]'
              )}
            >
              {doc.collected ? (
                <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#0F6E56' }} />
              ) : (
                <Circle className="w-4 h-4 mt-0.5 shrink-0 text-[#C0C6CE]" />
              )}
              <div className="min-w-0">
                <div
                  className={cn(
                    'text-sm font-medium',
                    doc.collected ? 'text-[#0F6E56]' : 'text-[#5F6B7A]'
                  )}
                >
                  {doc.label}
                </div>
                {doc.collected && doc.collectedAt && (
                  <div className="text-[11px] text-[#5F6B7A] mt-0.5">
                    {new Date(doc.collectedAt).toLocaleDateString()}
                  </div>
                )}
                <label
                  className="text-[11px] mt-1 inline-block cursor-pointer"
                  style={{ color: CS_ACCENT.text }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Upload
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => uploadDoc(doc, e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Notes / activity */}
      <Collapsible
        title="Notes / activity"
        open={notesOpen}
        onToggle={() => setNotesOpen((o) => !o)}
      >
        <div className="mb-4 space-y-2">
          <input
            className={inputCls}
            placeholder="Title"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addNote()
              }
            }}
          />
          <textarea
            className={inputCls + ' min-h-[72px] resize-y'}
            placeholder="Additional notes (optional)"
            value={noteDetails}
            onChange={(e) => setNoteDetails(e.target.value)}
          />
          <Button
            size="sm"
            className="text-white"
            style={{ backgroundColor: CS_ACCENT.solid }}
            onClick={addNote}
            disabled={!noteTitle.trim() && !noteDetails.trim()}
          >
            Add note
          </Button>
        </div>
        <ul className="space-y-2">
          {client.clientNotes.map((n) => {
            const parsed = parseActivityNote(n.content)
            const expanded = !!expandedNoteIds[n.id]
            const canExpand = !!parsed.body
            return (
              <li key={n.id} className="rounded-lg border border-[#E5E7EB] bg-[#F7F8FA]">
                <button
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
                  onClick={() => {
                    if (!canExpand) return
                    setExpandedNoteIds((prev) => ({ ...prev, [n.id]: !prev[n.id] }))
                  }}
                  disabled={!canExpand}
                >
                  {canExpand ? (
                    expanded ? (
                      <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[#8B95A1]" />
                    ) : (
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#8B95A1]" />
                    )
                  ) : (
                    <span className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[#1a1d21]">{parsed.title}</div>
                    <div className="text-xs text-[#8B95A1] mt-0.5">
                      {n.author.name || n.author.email} · {new Date(n.createdAt).toLocaleString()}
                    </div>
                    {expanded && parsed.body && (
                      <div className="mt-2 whitespace-pre-wrap text-sm text-[#5F6B7A]">
                        {parsed.body}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
          {client.clientNotes.length === 0 && (
            <li className="text-sm text-[#5F6B7A]">No activity yet</li>
          )}
        </ul>
      </Collapsible>

      {/* Service history */}
      <Collapsible
        title="Service history"
        open={historyOpen}
        onToggle={() => setHistoryOpen((o) => !o)}
      >
        <ul className="space-y-3">
          {(client.statusHistory ?? []).map((h) => (
            <li key={h.id} className="border-l-2 border-[#E5E7EB] pl-3 text-sm">
              <div className="text-[#1a1d21]">
                {h.fromStatus ?? '—'} → <strong>{h.toStatus}</strong>
                {h.reason ? ` — ${h.reason}` : ''}
              </div>
              <div className="text-xs text-[#8B95A1] mt-1">
                {h.changedByUser?.name || h.changedByUser?.email || 'System'} ·{' '}
                {new Date(h.createdAt).toLocaleString()}
              </div>
            </li>
          ))}
          {(!client.statusHistory || client.statusHistory.length === 0) && (
            <li className="text-sm text-[#5F6B7A]">No status changes recorded</li>
          )}
        </ul>
      </Collapsible>

      {canEditPhi && (
        <Card title="Delete client">
          <p className="text-sm text-[#5F6B7A] mb-3">
            Permanently remove this client and their notes, documents, and breaks. Schedule
            assignments will be unlinked. This cannot be undone.
          </p>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={deleteClient}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            {deleting ? 'Deleting…' : 'Delete this client'}
          </Button>
        </Card>
      )}
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-sm text-[#1a1d21] focus:outline-none focus:ring-2 focus:ring-[#378ADD]/25'

function BackLink() {
  return (
    <Link
      href="/client-services"
      className="inline-flex items-center gap-1 text-sm font-medium"
      style={{ color: CS_ACCENT.text }}
    >
      <ArrowLeft className="w-4 h-4" /> Back to clients
    </Link>
  )
}

function Card({
  title,
  subtitle,
  children,
}: {
  title?: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 sm:p-5">
      {title && (
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-[#1a1d21]">{title}</h3>
          {subtitle && <p className="text-xs text-[#8B95A1] mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-xs font-medium text-[#8B95A1] mb-1">{label}</div>
      <div className="text-sm text-[#1a1d21]">{children}</div>
    </div>
  )
}

function Alert({
  tone,
  children,
}: {
  tone: 'red' | 'amber'
  children: React.ReactNode
}) {
  const styles =
    tone === 'red'
      ? { bg: '#FCEBEB', text: '#A32D2D', border: '#F5C4C4' }
      : { bg: '#FAEEDA', text: '#854F0B', border: '#F0D5A8' }
  return (
    <div
      className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm"
      style={{ backgroundColor: styles.bg, color: styles.text, borderColor: styles.border }}
    >
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  )
}

function Collapsible({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 text-left"
      >
        <span className="text-sm font-semibold text-[#1a1d21]">{title}</span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-[#8B95A1]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[#8B95A1]" />
        )}
      </button>
      {open && <div className="px-4 sm:px-5 pb-5 border-t border-[#E5E7EB] pt-4">{children}</div>}
    </section>
  )
}
