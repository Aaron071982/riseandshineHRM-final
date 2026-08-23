'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import type { CrmRole } from '@prisma/client'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  createTrainingStep,
  deleteTrainingStep,
  listAllTrainingModulesForEditor,
  previewTrainingModuleForRole,
  updateTrainingModule,
  updateTrainingStep,
} from '@/lib/crm/training/actions'
import { TRAINING_MODULE_ROLE_LABELS } from '@/lib/crm/training/constants'
import { TrainingModulePanel, type TrainingModuleView } from '@/components/crm/profile/TrainingModulePanel'
import { cn } from '@/lib/utils'

type EditorModule = {
  id: string
  crmRole: CrmRole
  title: string
  summary: string | null
  goalStatement: string | null
  steps: {
    id: string
    stepNumber: number
    slug: string
    title: string
    body: string
    icon: string | null
  }[]
}

const PREVIEW_ROLES: CrmRole[] = [
  'CASE_COORDINATION',
  'INTAKE',
  'CLINICAL',
  'AUTHORIZATION',
  'BILLING',
  'STAFFING',
  'MANAGEMENT',
]

export function TrainingAdminEditor({ viewerUserId }: { viewerUserId: string }) {
  const [pending, startTransition] = useTransition()
  const [modules, setModules] = useState<EditorModule[]>([])
  const [selectedRole, setSelectedRole] = useState<CrmRole>('CASE_COORDINATION')
  const [preview, setPreview] = useState<TrainingModuleView | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')

  const load = useCallback(() => {
    startTransition(async () => {
      setError('')
      const res = await listAllTrainingModulesForEditor()
      if (!res.ok) {
        setError(res.error)
        return
      }
      setModules(res.modules as EditorModule[])
    })
  }, [])

  const loadPreview = useCallback((role: CrmRole) => {
    startTransition(async () => {
      const res = await previewTrainingModuleForRole(role)
      if (!res.ok || !res.module) {
        setPreview(null)
        return
      }
      const m = res.module
      setPreview({
        id: m.id,
        crmRole: m.crmRole,
        title: m.title,
        summary: m.summary,
        goalStatement: m.goalStatement,
        completedCount: 0,
        totalSteps: m.steps.length,
        percent: 0,
        steps: m.steps.map((s: (typeof m.steps)[number]) => ({ ...s, completed: false })),
      })
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadPreview(selectedRole)
  }, [selectedRole, loadPreview, modules])

  const selected = modules.find((m) => m.crmRole === selectedRole)

  const saveModuleMeta = (field: 'title' | 'summary' | 'goalStatement', value: string) => {
    if (!selected) return
    startTransition(async () => {
      setError('')
      setMessage('')
      const res = await updateTrainingModule(selected.id, {
        [field]: value || null,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setMessage('Saved')
      load()
    })
  }

  const startEditStep = (step: EditorModule['steps'][number]) => {
    setEditingStepId(step.id)
    setEditTitle(step.title)
    setEditBody(step.body)
  }

  const saveStep = () => {
    if (!editingStepId) return
    startTransition(async () => {
      setError('')
      const res = await updateTrainingStep(editingStepId, {
        title: editTitle,
        body: editBody,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setEditingStepId(null)
      setMessage('Step saved')
      load()
    })
  }

  const addStep = () => {
    if (!selected) return
    startTransition(async () => {
      setError('')
      const res = await createTrainingStep(selected.id, {
        title: 'New step',
        body: 'Describe this responsibility…',
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setMessage('Step added')
      load()
    })
  }

  const removeStep = (stepId: string) => {
    if (!confirm('Delete this step? Completions for it will be removed.')) return
    startTransition(async () => {
      const res = await deleteTrainingStep(stepId)
      if (!res.ok) {
        setError(res.error)
        return
      }
      load()
    })
  }

  return (
    <section className="crm-card overflow-hidden">
      <div className="border-b border-line bg-gradient-to-r from-[var(--sunrise-soft)]/40 to-surface px-4 py-4">
        <h3 className="font-display text-lg font-semibold text-ink">Training content editor</h3>
        <p className="mt-1 text-sm text-quiet">
          Edit what each role sees in their Profile training tab. Changes apply
          immediately for all staff.
        </p>
      </div>

      <div className="space-y-4 p-4">

      {(error || message) && (
        <p className={cn('text-sm', error ? 'text-[var(--urgent)]' : 'text-[var(--green)]')}>
          {error || message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {PREVIEW_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setSelectedRole(role)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
              selectedRole === role
                ? 'bg-[var(--espresso)] text-white shadow-sm'
                : 'border border-line text-quiet hover:bg-[var(--sunrise-soft)]'
            )}
          >
            {TRAINING_MODULE_ROLE_LABELS[role]}
          </button>
        ))}
      </div>

      {selected && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-line bg-[var(--bg)] p-4">
            <h4 className="text-sm font-semibold text-ink">Edit module</h4>
            <label className="block text-xs text-quiet">
              Title
              <input
                key={`title-${selected.id}`}
                defaultValue={selected.title}
                onBlur={(e) => {
                  if (e.target.value !== selected.title) {
                    saveModuleMeta('title', e.target.value)
                  }
                }}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs text-quiet">
              Summary
              <textarea
                key={`summary-${selected.id}`}
                defaultValue={selected.summary ?? ''}
                rows={2}
                onBlur={(e) => {
                  if (e.target.value !== (selected.summary ?? '')) {
                    saveModuleMeta('summary', e.target.value)
                  }
                }}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs text-quiet">
              Goal statement
              <textarea
                key={`goal-${selected.id}`}
                defaultValue={selected.goalStatement ?? ''}
                rows={2}
                onBlur={(e) => {
                  if (e.target.value !== (selected.goalStatement ?? '')) {
                    saveModuleMeta('goalStatement', e.target.value)
                  }
                }}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
              />
            </label>

            <div className="flex items-center justify-between pt-2">
              <h4 className="text-sm font-semibold text-ink">Steps</h4>
              <button
                type="button"
                onClick={addStep}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs hover:bg-line-2"
              >
                <Plus className="h-3 w-3" /> Add step
              </button>
            </div>

            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {selected.steps.map((step) => (
                <li
                  key={step.id}
                  className="rounded-lg border border-line bg-surface p-2 text-sm"
                >
                  {editingStepId === step.id ? (
                    <div className="space-y-2">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full rounded border border-line px-2 py-1 text-sm"
                      />
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={4}
                        className="w-full rounded border border-line px-2 py-1 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={saveStep}
                          disabled={pending}
                          className="rounded bg-[var(--sunrise-dark)] px-2 py-1 text-xs text-white"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingStepId(null)}
                          className="rounded border border-line px-2 py-1 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs text-[var(--sunrise-dark)]">
                          {step.stepNumber}.
                        </span>{' '}
                        {step.title}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => startEditStep(step)}
                          className="rounded p-1 hover:bg-line-2"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStep(step.id)}
                          className="rounded p-1 text-[var(--urgent)] hover:bg-[var(--urgent-bg)]"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-ink">
              Preview — what staff see
            </h4>
            {preview ? (
              <TrainingModulePanel
                module={preview}
                targetUserId={viewerUserId}
                readOnly
              />
            ) : (
              <p className="text-sm text-quiet">Loading preview…</p>
            )}
          </div>
        </div>
      )}
      </div>
    </section>
  )
}
