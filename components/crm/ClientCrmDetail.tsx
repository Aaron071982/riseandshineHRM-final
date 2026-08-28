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
import { ClientDocumentsPanel } from '@/components/crm/ClientDocumentsPanel'
import { ClientTasksPanel } from '@/components/crm/ClientTasksPanel'
import { EmailPanel } from '@/components/crm/EmailPanel'
import { advanceStage, setStage } from '@/lib/crm/actions'
import { REQUIREMENT_KEY_LABELS } from '@/lib/crm/stages'
import type { CommTemplate } from '@prisma/client'
import type { ClientCrmDetailData } from '@/lib/crm/loadClientDetail'
import type { EmailSendContext } from '@/components/crm/EmailPanel'
import type { ClientStage } from '@prisma/client'
import { cn } from '@/lib/utils'

type TabId =
  | 'overview'
  | 'requirements'
  | 'documents'
  | 'tasks'
  | 'notes'
  | 'activity'
  | 'staffing'
  | 'authorization'
  | 'schedule'
  | 'email'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'notes', label: 'Notes' },
  { id: 'staffing', label: 'Staffing' },
  { id: 'authorization', label: 'Authorization' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'email', label: 'Email' },
  { id: 'documents', label: 'Documents' },
  { id: 'activity', label: 'Activity' },
]

function resolveTab(value?: string | null): TabId {
  if (value === 'communications') return 'email'
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

  const { client, daysInStage, canOverrideStage, user, weeklyScheduleHours, emailSend, canEdit, teamTasks, taskUsers } =
    data

  const blockedLabels = useMemo(
    () => gateError.map((k) => REQUIREMENT_KEY_LABELS[k] ?? k),
    [gateError]
  )

  const staffingRbts = useMemo(
    () =>
      client.btAssignments
        .filter((a) => a.status === 'ACTIVE')
        .map((a) => ({
          assignmentId: a.id,
          label: a.rbtProfile
            ? `${a.rbtProfile.firstName} ${a.rbtProfile.lastName}`.trim()
            : a.btName?.trim() || 'Unnamed RBT',
          isPrimary: a.isPrimary,
        })),
    [client.btAssignments]
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
      const res = await setStage(client.id, to, reason, { confirmed: true })
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
            clientId={client.id}
            requirements={client.requirements}
            currentStage={client.stage}
            canEdit={canEdit}
          />
        )}
        {tab === 'documents' && (
          <ClientDocumentsPanel
            clientId={client.id}
            requirements={client.requirements}
          />
        )}
        {tab === 'tasks' && (
          <ClientTasksPanel
            clientId={client.id}
            clientName={`${client.firstName} ${client.lastName}`}
            tasks={teamTasks}
            users={taskUsers}
            currentUserId={user.id}
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
            stage={client.stage}
            staffingNeedsMoreHours={client.staffingNeedsMoreHours}
            staffingHighPriority={client.staffingHighPriority}
            assignments={client.btAssignments}
            bcbaProfile={client.bcbaProfile}
            bcbaProfileId={client.bcbaProfileId}
            addressLine={client.addressLine}
            city={client.city}
            state={client.state}
            zip={client.zip}
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
        {tab === 'email' && (
          <EmailPanel
            clientId={client.id}
            parentEmail={client.parentEmail}
            senderEmail={user.email}
            communications={client.communications}
            emailSend={emailSend}
            staffingRbts={staffingRbts}
          />
        )}
      </div>

      <p className="sr-only">Signed in as {user.email}</p>
    </div>
  )
}

export type SerializeClientDetail = {
  user: { id: string; email: string | null; fullAccess: boolean }
  daysInStage: number | null
  weeklyScheduleHours: number
  canOverrideStage: boolean
  canEdit: boolean
  gate: { ok: boolean; blockedBy: string[] }
  emailSend: EmailSendContext & { allowedTemplates: CommTemplate[] }
  client: ClientCrmDetailData['client']
  teamTasks: ClientCrmDetailData['teamTasks']
  taskUsers: ClientCrmDetailData['taskUsers']
}
