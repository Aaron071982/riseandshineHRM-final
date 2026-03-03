'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils'

type TabKey = 'documents' | 'credentials' | 'clinical' | 'supervision' | 'alerts'

interface EmployeeComplianceTabsProps {
  employeeId: string
  employeeType: string
  displayName: string
}

export default function EmployeeComplianceTabs({
  employeeId,
  employeeType,
  displayName,
}: EmployeeComplianceTabsProps) {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<TabKey>('documents')

  return (
    <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)] mt-6">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-semibold text-gray-900 dark:text-[var(--text-primary)]">
              Employment &amp; Compliance
            </CardTitle>
            <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mt-1">
              {displayName} • {employeeType}
            </p>
          </div>
          <div className="inline-flex rounded-full border border-gray-200 dark:border-[var(--border-subtle)] bg-gray-50 dark:bg-[var(--bg-primary)] p-1">
            <TabButton tab="documents" label="Documents" activeTab={activeTab} onChange={setActiveTab} />
            <TabButton tab="credentials" label="Credentials" activeTab={activeTab} onChange={setActiveTab} />
            <TabButton tab="clinical" label="Clinical Logs" activeTab={activeTab} onChange={setActiveTab} />
            <TabButton tab="supervision" label="Supervision" activeTab={activeTab} onChange={setActiveTab} />
            <TabButton tab="alerts" label="Alerts" activeTab={activeTab} onChange={setActiveTab} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {activeTab === 'documents' && (
          <DocumentsTab employeeId={employeeId} onError={(m) => showToast(m, 'error')} />
        )}
        {activeTab === 'credentials' && (
          <CredentialsTab employeeId={employeeId} onError={(m) => showToast(m, 'error')} />
        )}
        {activeTab === 'clinical' && (
          <ClinicalLogsTab employeeId={employeeId} onError={(m) => showToast(m, 'error')} />
        )}
        {activeTab === 'supervision' && (
          <SupervisionTab employeeId={employeeId} onError={(m) => showToast(m, 'error')} />
        )}
        {activeTab === 'alerts' && (
          <AlertsTab employeeId={employeeId} onError={(m) => showToast(m, 'error')} />
        )}
      </CardContent>
    </Card>
  )
}

interface TabButtonProps {
  tab: TabKey
  label: string
  activeTab: TabKey
  onChange: (tab: TabKey) => void
}

function TabButton({ tab, label, activeTab, onChange }: TabButtonProps) {
  const active = tab === activeTab
  return (
    <button
      type="button"
      onClick={() => onChange(tab)}
      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
        active
          ? 'bg-white text-gray-900 shadow-sm dark:bg-[var(--bg-elevated)] dark:text-[var(--text-primary)]'
          : 'text-gray-600 hover:text-gray-900 dark:text-[var(--text-tertiary)] dark:hover:text-[var(--text-secondary)]'
      }`}
    >
      {label}
    </button>
  )
}

interface EmploymentDocument {
  id: string
  docType: string
  status: string
  issuedAt: string | null
  expiresAt: string | null
  createdAt: string
}

function DocumentsTab({
  employeeId,
  onError,
}: {
  employeeId: string
  onError: (msg: string) => void
}) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [docs, setDocs] = useState<EmploymentDocument[]>([])
  const [docType, setDocType] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/admin/employees/${employeeId}/documents`, {
          credentials: 'include',
        })
        if (!res.ok) throw new Error('Failed to load documents')
        const data = await res.json()
        if (cancelled) return
        setDocs(data || [])
      } catch (e: any) {
        console.error(e)
        onError(e?.message || 'Failed to load documents')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [employeeId, onError])

  const handleAdd = async () => {
    if (!docType) {
      onError('Select a document type')
      return
    }
    try {
      const res = await fetch(`/api/admin/employees/${employeeId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ docType, expiresAt: expiresAt || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to create document')
      }
      setDocs((prev) => [data, ...prev])
      setDocType('')
      setExpiresAt('')
      showToast('Document record created', 'success')
    } catch (e: any) {
      console.error(e)
      onError(e?.message || 'Failed to create document')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-2 md:items-end">
        <div className="flex-1">
          <Input
            placeholder="Document type (e.g. EMPLOYMENT_AGREEMENT)"
            value={docType}
            onChange={(e) => setDocType(e.target.value.toUpperCase())}
          />
        </div>
        <div>
          <Input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full md:w-44"
          />
        </div>
        <Button onClick={handleAdd} size="sm">
          Add
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">Loading documents…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">No employment documents yet.</p>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-[var(--text-primary)]">
                  {d.docType.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-gray-500 dark:text-[var(--text-tertiary)]">
                  Issued {d.issuedAt ? formatDate(new Date(d.issuedAt)) : '—'} • Expires{' '}
                  {d.expiresAt ? formatDate(new Date(d.expiresAt)) : '—'}
                </p>
              </div>
              <Badge
                variant="outline"
                className="text-xs uppercase tracking-wide border-gray-300 dark:border-[var(--border-subtle)]"
              >
                {d.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface Credential {
  id: string
  credentialType: string
  credentialNumber: string
  state: string | null
  expiresAt: string | null
  verificationStatus: string
}

function CredentialsTab({
  employeeId,
  onError,
}: {
  employeeId: string
  onError: (msg: string) => void
}) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [creds, setCreds] = useState<Credential[]>([])
  const [credentialType, setCredentialType] = useState('')
  const [credentialNumber, setCredentialNumber] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/admin/employees/${employeeId}/credentials`, {
          credentials: 'include',
        })
        if (!res.ok) throw new Error('Failed to load credentials')
        const data = await res.json()
        if (cancelled) return
        setCreds(data || [])
      } catch (e: any) {
        console.error(e)
        onError(e?.message || 'Failed to load credentials')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [employeeId, onError])

  const handleAdd = async () => {
    if (!credentialType || !credentialNumber.trim()) {
      onError('Type and number are required')
      return
    }
    try {
      const res = await fetch(`/api/admin/employees/${employeeId}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credentialType, credentialNumber }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create credential')
      setCreds((prev) => [data, ...prev])
      setCredentialType('')
      setCredentialNumber('')
      showToast('Credential created', 'success')
    } catch (e: any) {
      console.error(e)
      onError(e?.message || 'Failed to create credential')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-2 md:items-end">
        <Input
          placeholder="Credential type (e.g. RBT_CERT)"
          value={credentialType}
          onChange={(e) => setCredentialType(e.target.value.toUpperCase())}
        />
        <Input
          placeholder="Credential number"
          value={credentialNumber}
          onChange={(e) => setCredentialNumber(e.target.value)}
        />
        <Button onClick={handleAdd} size="sm">
          Add
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">Loading credentials…</p>
      ) : creds.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">No credentials yet.</p>
      ) : (
        <div className="space-y-2">
          {creds.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-[var(--text-primary)]">
                  {c.credentialType.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-gray-500 dark:text-[var(--text-tertiary)]">
                  {c.credentialNumber}
                  {c.state ? ` • ${c.state}` : ''}
                  {c.expiresAt ? ` • Expires ${formatDate(new Date(c.expiresAt))}` : ''}
                </p>
              </div>
              <Badge
                variant="outline"
                className="text-xs uppercase tracking-wide border-gray-300 dark:border-[var(--border-subtle)]"
              >
                {c.verificationStatus}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface ClinicalLog {
  id: string
  serviceDate: string
  cptCode: string
  minutes: number | null
  units: number | null
  clientId: string
}

function ClinicalLogsTab({
  employeeId,
  onError,
}: {
  employeeId: string
  onError: (msg: string) => void
}) {
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<ClinicalLog[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/clinical/logs?employeeId=${encodeURIComponent(employeeId)}`, {
          credentials: 'include',
        })
        if (!res.ok) throw new Error('Failed to load clinical logs')
        const data = await res.json()
        if (cancelled) return
        setLogs(data || [])
      } catch (e: any) {
        console.error(e)
        onError(e?.message || 'Failed to load clinical logs')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [employeeId, onError])

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">Loading logs…</p>
  }

  if (logs.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">No clinical logs yet.</p>
  }

  return (
    <div className="space-y-2">
      {logs.map((l) => (
        <div
          key={l.id}
          className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] px-3 py-2 text-sm"
        >
          <div>
            <p className="font-medium text-gray-900 dark:text-[var(--text-primary)]">
              {formatDate(new Date(l.serviceDate))} • {l.cptCode}
            </p>
            <p className="text-xs text-gray-500 dark:text-[var(--text-tertiary)]">
              Minutes: {l.minutes ?? '—'} • Units: {l.units ?? '—'} • Client: {l.clientId}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

interface SupervisionEvent {
  id: string
  date: string
  minutes: number
  supervisionType: string
}

function SupervisionTab({
  employeeId,
  onError,
}: {
  employeeId: string
  onError: (msg: string) => void
}) {
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<SupervisionEvent[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(
          `/api/supervision/events?bcbaEmployeeId=${encodeURIComponent(employeeId)}`,
          { credentials: 'include' },
        )
        if (!res.ok) throw new Error('Failed to load supervision events')
        const data = await res.json()
        if (cancelled) return
        setEvents(data || [])
      } catch (e: any) {
        console.error(e)
        onError(e?.message || 'Failed to load supervision events')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [employeeId, onError])

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">Loading supervision…</p>
  }

  if (events.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">No supervision events yet.</p>
  }

  const totalMinutes = events.reduce((sum, e) => sum + (e.minutes || 0), 0)

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
        Total supervision minutes in range: <span className="font-semibold">{totalMinutes}</span>
      </p>
      <div className="space-y-2">
        {events.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium text-gray-900 dark:text-[var(--text-primary)]">
                {formatDate(new Date(e.date))} • {e.supervisionType.replace(/_/g, ' ')}
              </p>
              <p className="text-xs text-gray-500 dark:text-[var(--text-tertiary)]">
                Minutes: {e.minutes}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ComplianceAlert {
  id: string
  alertType: string
  severity: string
  message: string
  dueAt: string | null
  resolvedAt: string | null
}

function AlertsTab({
  employeeId,
  onError,
}: {
  employeeId: string
  onError: (msg: string) => void
}) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([])
  const [resolutionNote, setResolutionNote] = useState('')
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/admin/employees/${employeeId}/alerts`, {
          credentials: 'include',
        })
        if (!res.ok) throw new Error('Failed to load alerts')
        const data = await res.json()
        if (cancelled) return
        setAlerts(data || [])
      } catch (e: any) {
        console.error(e)
        onError(e?.message || 'Failed to load alerts')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [employeeId, onError])

  const handleResolve = async (id: string) => {
    setResolvingId(id)
    try {
      const res = await fetch(`/api/admin/employees/${employeeId}/alerts?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ resolutionNote: resolutionNote || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to resolve alert')
      setAlerts((prev) => prev.map((a) => (a.id === id ? data : a)))
      setResolutionNote('')
      showToast('Alert resolved', 'success')
    } catch (e: any) {
      console.error(e)
      onError(e?.message || 'Failed to resolve alert')
    } finally {
      setResolvingId(null)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">Loading alerts…</p>
  }

  if (alerts.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">No active alerts.</p>
  }

  return (
    <div className="space-y-4">
      {alerts.map((a) => (
        <div
          key={a.id}
          className="rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] p-3 text-sm space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium text-gray-900 dark:text-[var(--text-primary)]">
                {a.alertType.replace(/_/g, ' ')}
              </p>
              <p className="text-xs text-gray-600 dark:text-[var(--text-tertiary)] whitespace-pre-line">
                {a.message}
              </p>
            </div>
            <Badge
              variant="outline"
              className={`text-xs uppercase tracking-wide ${
                a.severity === 'BLOCKER'
                  ? 'border-red-500 text-red-600'
                  : a.severity === 'WARN'
                    ? 'border-amber-500 text-amber-600'
                    : 'border-gray-300 text-gray-600'
              }`}
            >
              {a.severity}
            </Badge>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <Textarea
              placeholder="Resolution note (optional)…"
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              rows={2}
            />
            <Button
              size="sm"
              onClick={() => handleResolve(a.id)}
              disabled={!!a.resolvedAt || resolvingId === a.id}
            >
              {a.resolvedAt ? 'Resolved' : resolvingId === a.id ? 'Resolving…' : 'Resolve'}
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

