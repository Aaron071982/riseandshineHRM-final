'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ClientFiveFieldHeader } from '@/components/crm/ClientFiveFieldHeader'
import { StageStepper } from '@/components/crm/StageStepper'
import { TreatmentPlanTrack } from '@/components/crm/TreatmentPlanTrack'
import { RequirementsPanel } from '@/components/crm/RequirementsPanel'
import { NotesPanel, OverviewPanel } from '@/components/crm/NotesPanel'
import { ActivityPanel } from '@/components/crm/ActivityPanel'
import { AuthorizationPanel } from '@/components/crm/AuthorizationPanel'
import { StaffingPanel } from '@/components/crm/StaffingPanel'
import { SchedulePanel } from '@/components/crm/SchedulePanel'
import { CommunicationsPanel } from '@/components/crm/CommunicationsPanel'
import { advanceStage, setStage } from '@/lib/crm/actions'
import { REQUIREMENT_KEY_LABELS } from '@/lib/crm/stages'
import type { ClientCrmDetailData } from '@/lib/crm/loadClientDetail'
import type { ClientStage } from '@prisma/client'
import { cn } from '@/lib/utils'

type TabId =
  | 'overview'
  | 'requirements'
  | 'notes'
  | 'activity'
  | 'staffing'
  | 'authorization'
  | 'schedule'
  | 'communications'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'notes', label: 'Notes' },
  { id: 'activity', label: 'Activity' },
  { id: 'staffing', label: 'Staffing' },
  { id: 'authorization', label: 'Authorization' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'communications', label: 'Communications' },
]

function resolveTab(value?: string | null): TabId {
  if (value && TABS.some((t) => t.id === value)) return value as TabId
  return 'overview'
}

export default function ClientCrmDetail({
  data,
  initialTab,
}: {
  data: SerializeClientDetail
  initialTab?: string | null
}) {
  const router = useRouter()
  const [tab, setTab] = useState<TabId>(() => resolveTab(initialTab))
  const [pending, startTransition] = useTransition()
  const [gateError, setGateError] = useState<string[]>(data.gate.blockedBy)
  const [gateOk, setGateOk] = useState(data.gate.ok)

  useEffect(() => {
    setGateOk(data.gate.ok)
    setGateError(data.gate.blockedBy)
  }, [data.gate.ok, data.gate.blockedBy])

  useEffect(() => {
    setTab(resolveTab(initialTab))
  }, [initialTab])

  const { client, daysInStage, canOverrideStage, user, weeklyScheduleHours } =
    data
  const canEdit = true

  const blockedLabels = useMemo(
    () => gateError.map((k) => REQUIREMENT_KEY_LABELS[k] ?? k),
    [gateError]
  )

  const onAdvance = () => {
    startTransition(async () => {
      const res = await advanceStage(client.id)
      if (!res.ok) {
        if (res.blocked && res.blockedBy) {
          setGateOk(false)
          setGateError(res.blockedBy)
        }
        return
      }
      setGateOk(true)
      setGateError([])
      router.refresh()
    })
  }

  const onSetStage = (to: ClientStage) => {
    if (to === client.stage) return
    const reason = window.prompt('Reason for manual stage change?') || ''
    if (!reason.trim()) return
    startTransition(async () => {
      const res = await setStage(client.id, to, reason)
      if (res.ok) router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-16">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/client-services/clients"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm text-quiet hover:bg-line-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Caseload
        </Link>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            {client.firstName} {client.lastName}
          </h1>
          <p className="text-sm tabular-nums text-quiet">{client.clientCode}</p>
        </div>
      </div>

      <ClientFiveFieldHeader
        clientId={client.id}
        stage={client.stage}
        ownerDept={client.currentOwnerDept}
        ownerName={
          client.currentOwnerUser?.name ||
          client.currentOwnerUser?.email ||
          null
        }
        nextAction={client.nextAction}
        nextActionDueAt={
          client.nextActionDueAt
            ? new Date(client.nextActionDueAt).toISOString()
            : null
        }
        daysInStage={daysInStage}
        rbtTargetDate={
          client.rbtTargetDate
            ? new Date(client.rbtTargetDate).toISOString()
            : null
        }
        canEdit={canEdit}
      />

      <StageStepper
        stage={client.stage}
        gate={{ ok: gateOk, blockedBy: gateError }}
        blockedLabels={blockedLabels}
        onAdvance={onAdvance}
        advancing={pending}
        canEdit={canEdit}
        fullAccess={canOverrideStage}
        onSetStage={onSetStage}
      />

      <TreatmentPlanTrack
        clientId={client.id}
        status={client.treatmentPlanStatus}
        completedAt={
          client.treatmentPlanCompletedAt
            ? new Date(client.treatmentPlanCompletedAt).toISOString()
            : null
        }
        canEdit={canEdit}
      />

      <div className="flex gap-1 overflow-x-auto border-b border-line pb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'shrink-0 rounded-t-lg px-3 py-2 text-sm font-medium transition-colors',
              tab === t.id
                ? 'bg-surface text-brand border border-b-surface border-line -mb-px'
                : 'text-quiet hover:text-ink'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {tab === 'overview' && (
          <OverviewPanel client={client} canEdit={canEdit} />
        )}
        {tab === 'requirements' && (
          <RequirementsPanel
            requirements={client.requirements}
            currentStage={client.stage}
            canEdit={canEdit}
          />
        )}
        {tab === 'notes' && (
          <NotesPanel
            clientId={client.id}
            notes={client.clientNotes}
            pipelineStatus={client.pipelineStatus}
            lastParentContactAt={client.lastParentContactAt}
            canEdit={canEdit}
          />
        )}
        {tab === 'activity' && (
          <ActivityPanel
            history={client.statusHistory}
            accessLogs={client.accessLogs}
          />
        )}
        {tab === 'staffing' && (
          <StaffingPanel
            clientId={client.id}
            assignments={client.btAssignments}
            bcbaProfile={client.bcbaProfile}
            bcbaProfileId={client.bcbaProfileId}
            canEdit={canEdit}
          />
        )}
        {tab === 'authorization' && (
          <AuthorizationPanel
            clientId={client.id}
            authorizations={client.authorizations}
            canEdit={canEdit}
          />
        )}
        {tab === 'schedule' && (
          <SchedulePanel
            clientId={client.id}
            slots={client.scheduleAssignments}
            weeklyHours={weeklyScheduleHours}
            authHours={client.authHours}
            assignedRbtIds={client.btAssignments
              .map((a) => a.rbtProfileId)
              .filter((id): id is string => !!id)}
            canEdit={canEdit}
          />
        )}
        {tab === 'communications' && (
          <CommunicationsPanel
            clientId={client.id}
            communications={client.communications}
            canEdit={canEdit}
          />
        )}
      </div>

      <p className="sr-only">Signed in as {user.email}</p>
    </div>
  )
}

/** JSON-safe shape after server → client serialization. */
export type SerializeClientDetail = {
  user: { id: string; email: string | null; fullAccess: boolean }
  daysInStage: number | null
  weeklyScheduleHours: number
  canOverrideStage: boolean
  gate: { ok: boolean; blockedBy: string[] }
  client: ClientCrmDetailData['client']
}
