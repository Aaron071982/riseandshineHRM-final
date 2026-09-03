'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ClientFiveFieldHeader } from '@/components/crm/ClientFiveFieldHeader'
import { StageStepper } from '@/components/crm/StageStepper'
import { RequirementsPanel } from '@/components/crm/RequirementsPanel'
import { NotesPanel, OverviewPanel } from '@/components/crm/NotesPanel'
import { ActivityPanel } from '@/components/crm/ActivityPanel'
import { AuthorizationPanel } from '@/components/crm/AuthorizationPanel'
import { BillingAuthorizationPanel } from '@/components/crm/BillingAuthorizationPanel'
import { TreatmentAssessmentPanel } from '@/components/crm/assessment/TreatmentAssessmentPanel'
import { StaffingPanel } from '@/components/crm/StaffingPanel'
import { SchedulePanel } from '@/components/crm/SchedulePanel'
import { ClientDocumentsPanel } from '@/components/crm/ClientDocumentsPanel'
import { ClientTasksPanel } from '@/components/crm/ClientTasksPanel'
import { EmailPanel } from '@/components/crm/EmailPanel'
import { advanceStage, setStage } from '@/lib/crm/actions'
import type { StageWarningCode } from '@/lib/crm/stageWarnings'
import { STAGE_LABELS } from '@/lib/crm/stages'
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
  | 'assessment'
  | 'schedule'
  | 'email'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'notes', label: 'Notes' },
  { id: 'staffing', label: 'Staffing' },
  { id: 'authorization', label: 'Authorization' },
  { id: 'assessment', label: 'Assessment' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'email', label: 'Email' },
  { id: 'documents', label: 'Documents' },
  { id: 'activity', label: 'Activity' },
]

function resolveTab(value?: string | null): TabId {
  if (value === 'communications') return 'email'
  // Former Case Coordination tab — keep old deep links from breaking
  if (value === 'case-coordination') return 'overview'
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

  useEffect(() => {
    setTab(resolveTab(initialTab))
  }, [initialTab])

  const { client, daysInStage, canOverrideStage, user, weeklyScheduleHours, emailSend, canEdit, teamTasks, taskUsers, billing, treatmentAssessment } =
    data

  const visibleTabs = TABS.filter((t) => {
    if (t.id === 'assessment') return treatmentAssessment?.canView
    return true
  })

  const runStageAction = (
    action: (opts: {
      confirmed: true
      warningOverrides?: StageWarningCode[]
    }) => ReturnType<typeof advanceStage>
  ) => {
    startTransition(async () => {
      let warningOverrides: StageWarningCode[] | undefined
      for (;;) {
        const res = await action({ confirmed: true, warningOverrides })
        if (res.ok) {
          router.refresh()
          return
        }
        if (res.needsWarningConfirm && res.warnings?.length) {
          const proceed = window.confirm(
            res.warnings.map((w) => w.message).join('\n\n')
          )
          if (!proceed) return
          warningOverrides = res.warnings.map((w) => w.code)
          continue
        }
        return
      }
    })
  }

  const onAdvance = () => {
    if (
      !window.confirm(
        'Advance this client to the next stage? This updates ownership and pipeline history.'
      )
    ) {
      return
    }
    runStageAction((opts) => advanceStage(client.id, opts))
  }

  const onSetStage = (to: ClientStage) => {
    if (to === client.stage) return
    if (
      !window.confirm(
        `Move this client to "${STAGE_LABELS[to]}"? This updates ownership and pipeline history.`
      )
    ) {
      return
    }
    runStageAction((opts) => setStage(client.id, to, '', opts))
  }

  const staffingRbts = client.btAssignments
    .filter((a) => a.status === 'ACTIVE')
    .map((a) => ({
      assignmentId: a.id,
      label: a.rbtProfile
        ? `${a.rbtProfile.firstName} ${a.rbtProfile.lastName}`.trim()
        : a.btName?.trim() || 'Unnamed RBT',
      isPrimary: a.isPrimary,
    }))

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
        onAdvance={onAdvance}
        advancing={pending}
        canEdit={canEdit}
        fullAccess={canOverrideStage}
        onSetStage={onSetStage}
      />

      <div className="flex gap-1 overflow-x-auto border-b border-line pb-px">
        {visibleTabs.map((t) => (
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
        {tab === 'authorization' &&
          (billing?.canAccess ? (
            <BillingAuthorizationPanel
              clientId={client.id}
              stage={client.stage}
              authorizations={client.authorizations}
              canEdit={canEdit}
              billingCanEdit={billing.canEdit}
              authRequired={client.authRequired}
              vobResult={client.vobResult}
              documentsAvailable={billing.documentsAvailable}
              requirements={client.requirements}
              billingNotes={billing.notes}
              authorizationTemplate={billing.authorizationTemplate}
            />
          ) : (
            <AuthorizationPanel
              clientId={client.id}
              authorizations={client.authorizations}
              canEdit={canEdit}
              authRequired={client.authRequired}
              paAutoSatisfied={!client.authRequired}
            />
          ))}
        {tab === 'assessment' && treatmentAssessment?.canView && (
          <TreatmentAssessmentPanel
            clientId={client.id}
            clientCode={client.clientCode}
            assessments={treatmentAssessment.assessments ?? []}
            hasAssessmentOnFile={treatmentAssessment.hasAssessmentOnFile ?? false}
            canEdit={treatmentAssessment.canEdit ?? false}
            canUpload={treatmentAssessment.canUpload ?? false}
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
  emailSend: EmailSendContext & { allowedTemplates: CommTemplate[] }
  billing?: ClientCrmDetailData['billing']
  treatmentAssessment?: ClientCrmDetailData['treatmentAssessment']
  client: ClientCrmDetailData['client']
  teamTasks: ClientCrmDetailData['teamTasks']
  taskUsers: ClientCrmDetailData['taskUsers']
}
