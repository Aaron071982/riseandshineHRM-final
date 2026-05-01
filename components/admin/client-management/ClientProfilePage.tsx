'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { CRM_CLIENT_STATUSES, CLIENT_NOTE_TYPES } from '@/lib/crm-client/constants'
import { formatMMDDYYYY } from '@/lib/crm-client/display'
import AssignRbtModal from '@/components/admin/client-management/AssignRbtModal'
import InsuranceUtilizationBar from '@/components/admin/client-management/InsuranceUtilizationBar'
import { Loader2, MapPin } from 'lucide-react'

export default function ClientProfilePage({ clientId }: { clientId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [assignOpen, setAssignOpen] = useState(false)
  const [noteType, setNoteType] = useState('GENERAL')
  const [noteContent, setNoteContent] = useState('')
  const [bcbaOptions, setBcbaOptions] = useState<{ id: string; fullName: string }[]>([])
  const [bcbaPick, setBcbaPick] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setData(json)
    } catch {
      showToast('Failed to load client', 'error')
    } finally {
      setLoading(false)
    }
  }, [clientId, showToast])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (searchParams.get('assign') === '1') {
      setAssignOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    fetch('/api/admin/clients/options/bcba', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => setBcbaOptions(j.bcbas ?? []))
      .catch(() => {})
  }, [])

  const client = data?.client
  const currentUserId = data?.currentUserId as string | undefined

  const statusBadgeClass = (s: string) => {
    if (s === 'ACTIVE') return 'bg-emerald-100 text-emerald-900'
    if (s === 'WAITING') return 'bg-amber-100 text-amber-900'
    if (s === 'NEW_INTAKE') return 'bg-blue-100 text-blue-900'
    return 'bg-gray-100 text-gray-800'
  }

  const addNote = async () => {
    if (!noteContent.trim()) return
    const res = await fetch(`/api/admin/clients/${clientId}/notes`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: noteContent, noteType }),
    })
    if (!res.ok) {
      showToast('Failed to save note', 'error')
      return
    }
    setNoteContent('')
    showToast('Note saved', 'success')
    load()
  }

  const deleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return
    const res = await fetch(`/api/admin/clients/${clientId}/notes/${noteId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) {
      showToast('Cannot delete', 'error')
      return
    }
    load()
  }

  const assignBcba = async () => {
    if (!bcbaPick) return
    const res = await fetch(`/api/admin/clients/${clientId}/bcba-assignments`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bcbaProfileId: bcbaPick }),
    })
    if (!res.ok) {
      showToast('Failed to assign BCBA', 'error')
      return
    }
    setBcbaPick('')
    showToast('BCBA assigned', 'success')
    load()
  }

  if (loading || !client) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
      </div>
    )
  }

  const budget = client.cumulativeAuthorizedHoursBudget as number | null
  const used = Number(client.usedHoursTotal ?? 0)

  return (
    <div className="space-y-6 pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-4">
          <div className="rounded-xl border bg-white dark:bg-[var(--bg-elevated)] p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
              {client.firstName} {client.lastName}
            </h1>
            <Badge className={`mt-2 ${statusBadgeClass(client.status)}`}>{client.status}</Badge>
            <p className="mt-2 text-sm text-gray-600">
              Age {client.age ?? '—'} · DOB {data.display?.dobFormatted ?? '—'}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => setAssignOpen(true)}>
                Assign RBT
              </Button>
              <Select
                value={client.status}
                onValueChange={async (toStatus) => {
                  const res = await fetch(`/api/admin/clients/${clientId}/status`, {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ toStatus }),
                  })
                  if (res.ok) {
                    showToast('Status updated', 'success')
                    load()
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Change status" />
                </SelectTrigger>
                <SelectContent>
                  {CRM_CLIENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border p-4 shadow-sm bg-white dark:bg-[var(--bg-elevated)]">
            <h3 className="font-semibold mb-2">Contact</h3>
            <p className="text-sm">{client.guardianName ?? '—'}</p>
            <p className="text-sm text-gray-600">{client.guardianRelationship ?? ''}</p>
            <p className="text-sm mt-2">
              <a href={`tel:${client.guardianPhone}`} className="text-orange-600">
                {client.guardianPhone ?? '—'}
              </a>
            </p>
            <p className="text-sm">
              <a href={`mailto:${client.guardianEmail}`} className="text-orange-600">
                {client.guardianEmail ?? '—'}
              </a>
            </p>
            <p className="text-sm mt-2">Language: {client.preferredLanguage ?? '—'}</p>
          </div>

          <div className="rounded-xl border p-4 shadow-sm bg-white dark:bg-[var(--bg-elevated)]">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Location
            </h3>
            <p className="text-sm whitespace-pre-line">
              {[client.addressLine1, client.addressLine2, [client.city, client.state, client.zipCode].filter(Boolean).join(', ')]
                .filter(Boolean)
                .join('\n')}
            </p>
            <Button variant="outline" className="mt-3 w-full" onClick={() => setAssignOpen(true)}>
              Find nearest RBTs
            </Button>
          </div>

          <div className="rounded-xl border p-4 shadow-sm bg-white dark:bg-[var(--bg-elevated)]">
            <h3 className="font-semibold mb-2">Insurance</h3>
            <dl className="text-sm space-y-1">
              <dt className="text-gray-500">Provider</dt>
              <dd>{client.insuranceProvider ?? '—'}</dd>
              <dt className="text-gray-500">Member ID</dt>
              <dd>{client.insuranceMemberId ?? '—'}</dd>
              <dt className="text-gray-500">Auth period</dt>
              <dd>
                {data.display?.authStartFormatted} → {data.display?.authEndFormatted}
              </dd>
              <dt className="text-gray-500">Hrs/week</dt>
              <dd>{client.authorizedHoursPerWeek ?? '—'}</dd>
            </dl>
            <InsuranceUtilizationBar used={used} budget={budget} className="mt-4" />
          </div>

          <div className="rounded-xl border p-4 shadow-sm bg-white dark:bg-[var(--bg-elevated)]">
            <h3 className="font-semibold mb-2">Preferences</h3>
            <p className="text-sm">RBT gender: {client.preferredRbtGender ?? '—'}</p>
            <p className="text-sm">RBT ethnicity: {client.preferredRbtEthnicity ?? '—'}</p>
            <p className="text-sm">
              Intake:{' '}
              {client.intakeDate ? formatMMDDYYYY(new Date(client.intakeDate)) : '—'}
            </p>
            <p className="text-sm">
              First session:{' '}
              {client.firstSessionDate ? formatMMDDYYYY(new Date(client.firstSessionDate)) : '—'}
            </p>
          </div>
        </div>

        <div className="lg:col-span-2">
          <Tabs defaultValue="assignments">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="assignments">Assignments</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="history">Status history</TabsTrigger>
              <TabsTrigger value="auth">Authorization</TabsTrigger>
            </TabsList>

            <TabsContent value="assignments" className="space-y-6 mt-4">
              <section className="rounded-xl border p-4 bg-white dark:bg-[var(--bg-elevated)]">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold">Assigned RBTs ({client.rbtAssignments?.length ?? 0})</h3>
                  <Button size="sm" className="bg-orange-600" onClick={() => setAssignOpen(true)}>
                    Assign New RBT
                  </Button>
                </div>
                {!client.rbtAssignments?.length ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
                    <p className="font-bold text-red-800">No RBT Assigned</p>
                    <p className="text-sm text-red-700 mt-2">
                      This client has no active RBT. Find and assign one now.
                    </p>
                    <Button className="mt-4 bg-orange-600" onClick={() => setAssignOpen(true)}>
                      Find nearest RBTs →
                    </Button>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {client.rbtAssignments.map((a: any) => (
                      <li key={a.id} className="flex flex-wrap justify-between gap-2 border rounded-lg p-3">
                        <div>
                          <Link
                            href={`/admin/rbts/${a.rbtProfileId}`}
                            className="font-medium text-orange-700 hover:underline"
                          >
                            {a.rbtProfile.firstName} {a.rbtProfile.lastName}
                          </Link>
                          {a.isPrimary && (
                            <Badge className="ml-2" variant="secondary">
                              Primary
                            </Badge>
                          )}
                          <p className="text-xs text-gray-500">
                            {a.daysOfWeek?.join(', ') || '—'} · {a.timeStart}–{a.timeEnd}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {!a.isPrimary && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                await fetch(
                                  `/api/admin/clients/${clientId}/rbt-assignments/${a.id}`,
                                  {
                                    method: 'PATCH',
                                    credentials: 'include',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'setPrimary' }),
                                  }
                                )
                                load()
                              }}
                            >
                              Set primary
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={async () => {
                              if (!confirm('End this assignment?')) return
                              await fetch(
                                `/api/admin/clients/${clientId}/rbt-assignments/${a.id}`,
                                {
                                  method: 'PATCH',
                                  credentials: 'include',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ action: 'end' }),
                                }
                              )
                              load()
                            }}
                          >
                            End
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-xl border p-4 bg-white dark:bg-[var(--bg-elevated)]">
                <h3 className="font-semibold mb-3">BCBA</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Select value={bcbaPick} onValueChange={setBcbaPick}>
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="Select BCBA" />
                    </SelectTrigger>
                    <SelectContent>
                      {bcbaOptions.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="secondary" onClick={assignBcba}>
                    Assign BCBA
                  </Button>
                </div>
                <ul className="space-y-2">
                  {client.bcbaAssignments?.map((a: any) => (
                    <li key={a.id} className="text-sm border rounded p-2">
                      <span className="font-medium">{a.bcbaProfile.fullName}</span> · {a.status}
                    </li>
                  ))}
                </ul>
              </section>
            </TabsContent>

            <TabsContent value="notes" className="mt-4 space-y-4">
              <div className="rounded-xl border p-4 bg-white dark:bg-[var(--bg-elevated)] space-y-3">
                <Select value={noteType} onValueChange={setNoteType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_NOTE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <textarea
                  className="w-full min-h-[80px] rounded-md border px-3 py-2 text-sm"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Note…"
                />
                <Button className="bg-orange-600" onClick={addNote}>
                  Save note
                </Button>
              </div>
              <div className="space-y-3">
                {client.clientNotes?.map((n: any) => (
                  <div key={n.id} className="border rounded-lg p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{n.author?.name ?? 'Admin'}</span>
                      <Badge variant="outline">{n.noteType}</Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap">{n.content}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                    {n.author?.id === currentUserId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2"
                        onClick={() => deleteNote(n.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-4 space-y-3">
              {client.statusHistory?.map((h: any) => (
                <div key={h.id} className="border-l-4 border-orange-400 pl-3 py-2">
                  <p className="text-sm">
                    <strong>{h.fromStatus ?? '∅'}</strong> → <strong>{h.toStatus}</strong>
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(h.createdAt).toLocaleString()} · {h.changedBy?.name ?? ''}
                  </p>
                  {h.reason && <p className="text-sm mt-1">{h.reason}</p>}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="auth" className="mt-4 space-y-4">
              <div className="rounded-xl border p-4">
                <p className="text-sm mb-4">
                  Edit authorization fields using the main PATCH endpoint — quick inline:
                </p>
                <AuthInlineForm clientId={clientId} client={client} onSaved={load} />
                <InsuranceUtilizationBar used={used} budget={budget} className="mt-6 max-w-md" />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <AssignRbtModal
        clientId={clientId}
        open={assignOpen}
        onClose={() => {
          setAssignOpen(false)
          router.replace(`/admin/clients/${clientId}`)
        }}
        onAssigned={load}
      />
    </div>
  )
}

function AuthInlineForm({
  clientId,
  client,
  onSaved,
}: {
  clientId: string
  client: any
  onSaved: () => void
}) {
  const { showToast } = useToast()
  const [authNum, setAuthNum] = useState(client.authorizationNumber ?? '')
  const [authStart, setAuthStart] = useState(
    client.authorizationStartDate ? client.authorizationStartDate.slice(0, 10) : ''
  )
  const [authEnd, setAuthEnd] = useState(
    client.authorizationEndDate ? client.authorizationEndDate.slice(0, 10) : ''
  )
  const [hrs, setHrs] = useState(String(client.authorizedHoursPerWeek ?? ''))

  const save = async () => {
    const res = await fetch(`/api/admin/clients/${clientId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorizationNumber: authNum || null,
        authorizationStartDate: authStart || null,
        authorizationEndDate: authEnd || null,
        authorizedHoursPerWeek: hrs ? Number(hrs) : null,
      }),
    })
    if (!res.ok) {
      showToast('Save failed', 'error')
      return
    }
    showToast('Saved', 'success')
    onSaved()
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <Label>Authorization #</Label>
        <Input value={authNum} onChange={(e) => setAuthNum(e.target.value)} />
      </div>
      <div>
        <Label>Hrs/week</Label>
        <Input value={hrs} onChange={(e) => setHrs(e.target.value)} />
      </div>
      <div>
        <Label>Start</Label>
        <Input type="date" value={authStart} onChange={(e) => setAuthStart(e.target.value)} />
      </div>
      <div>
        <Label>End</Label>
        <Input type="date" value={authEnd} onChange={(e) => setAuthEnd(e.target.value)} />
      </div>
      <Button className="md:col-span-2 bg-orange-600 w-fit" onClick={save}>
        Save authorization
      </Button>
    </div>
  )
}
