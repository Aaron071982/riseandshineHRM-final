'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import type { CrmRole } from '@prisma/client'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  addTrainingVideo,
  createTrainingStep,
  deleteTrainingStep,
  deleteTrainingVideo,
  listAllTrainingModulesForEditor,
  previewTrainingModuleForRole,
  reorderTrainingSteps,
  updateTrainingModule,
  updateTrainingStep,
  updateTrainingVideo,
} from '@/lib/crm/training/actions'
import { TRAINING_MODULE_ROLE_LABELS } from '@/lib/crm/training/constants'
import {
  extractYoutubeVideoId,
  youtubeThumbnailUrl,
} from '@/lib/crm/training/youtube'
import {
  TrainingModulePanel,
  type TrainingModuleView,
} from '@/components/crm/profile/TrainingModulePanel'
import { cn } from '@/lib/utils'

type EditorStep = {
  id: string
  stepNumber: number
  slug: string
  title: string
  body: string
  icon: string | null
}

type EditorVideo = {
  id: string
  url: string
  videoId: string
  title: string | null
  position: number
}

type EditorModule = {
  id: string
  crmRole: CrmRole
  title: string
  summary: string | null
  goalStatement: string | null
  steps: EditorStep[]
  videos: EditorVideo[]
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

function SortableStepRow({
  step,
  pending,
  editingStepId,
  editTitle,
  editBody,
  setEditTitle,
  setEditBody,
  onStartEdit,
  onSave,
  onCancelEdit,
  onDelete,
}: {
  step: EditorStep
  pending: boolean
  editingStepId: string | null
  editTitle: string
  editBody: string
  setEditTitle: (v: string) => void
  setEditBody: (v: string) => void
  onStartEdit: (step: EditorStep) => void
  onSave: () => void
  onCancelEdit: () => void
  onDelete: (stepId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border border-line bg-surface p-2 text-sm',
        isDragging && 'z-10 shadow-md ring-1 ring-[var(--brand)]/30'
      )}
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
              onClick={onSave}
              disabled={pending}
              className="rounded bg-[var(--sunrise-dark)] px-2 py-1 text-xs text-white"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded border border-line px-2 py-1 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <button
            type="button"
            className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-1 text-quiet hover:bg-line-2 hover:text-ink active:cursor-grabbing"
            aria-label={`Drag to reorder step ${step.stepNumber}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold tabular-nums text-[var(--sunrise-dark)]">
              {step.stepNumber}.
            </span>{' '}
            {step.title}
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => onStartEdit(step)}
              className="rounded p-1 hover:bg-line-2"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(step.id)}
              className="rounded p-1 text-[var(--urgent)] hover:bg-[var(--urgent-bg)]"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

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
  const [videoUrl, setVideoUrl] = useState('')
  const [videoTitle, setVideoTitle] = useState('')
  const [videoUrlError, setVideoUrlError] = useState('')
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null)
  const [editVideoUrl, setEditVideoUrl] = useState('')
  const [editVideoTitle, setEditVideoTitle] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const load = useCallback(() => {
    startTransition(async () => {
      setError('')
      const res = await listAllTrainingModulesForEditor()
      if (!res.ok) {
        setError(res.error)
        return
      }
      setModules(
        (res.modules as EditorModule[]).map((m) => ({
          ...m,
          videos: m.videos ?? [],
        }))
      )
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
        steps: m.steps.map((s: (typeof m.steps)[number]) => ({
          ...s,
          completed: false,
        })),
        videos: (m.videos ?? []).map((v: EditorVideo) => ({
          id: v.id,
          url: v.url,
          videoId: v.videoId,
          title: v.title,
          position: v.position,
        })),
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

  const saveModuleMeta = (
    field: 'title' | 'summary' | 'goalStatement',
    value: string
  ) => {
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

  const startEditStep = (step: EditorStep) => {
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

  const onDragEnd = (event: DragEndEvent) => {
    if (!selected) return
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = selected.steps.findIndex((s) => s.id === active.id)
    const newIndex = selected.steps.findIndex((s) => s.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const previous = selected.steps
    const next = arrayMove(selected.steps, oldIndex, newIndex).map((s, i) => ({
      ...s,
      stepNumber: i + 1,
    }))

    setModules((mods) =>
      mods.map((m) => (m.id === selected.id ? { ...m, steps: next } : m))
    )

    startTransition(async () => {
      setError('')
      const res = await reorderTrainingSteps(
        selected.id,
        next.map((s) => s.id)
      )
      if (!res.ok) {
        setModules((mods) =>
          mods.map((m) =>
            m.id === selected.id ? { ...m, steps: previous } : m
          )
        )
        setError(res.error || 'Failed to save step order')
        return
      }
      setMessage('Step order saved')
      load()
    })
  }

  const addVideo = () => {
    if (!selected) return
    setVideoUrlError('')
    const id = extractYoutubeVideoId(videoUrl)
    if (!id) {
      setVideoUrlError(
        'Paste a valid YouTube link (watch, youtu.be, shorts, or embed)'
      )
      return
    }
    startTransition(async () => {
      setError('')
      const res = await addTrainingVideo(selected.id, {
        url: videoUrl,
        title: videoTitle || null,
      })
      if (!res.ok) {
        setVideoUrlError(res.error)
        return
      }
      setVideoUrl('')
      setVideoTitle('')
      setMessage('Video added')
      load()
    })
  }

  const startEditVideo = (video: EditorVideo) => {
    setEditingVideoId(video.id)
    setEditVideoUrl(video.url)
    setEditVideoTitle(video.title ?? '')
  }

  const saveVideo = () => {
    if (!editingVideoId) return
    if (!extractYoutubeVideoId(editVideoUrl)) {
      setError('Paste a valid YouTube link')
      return
    }
    startTransition(async () => {
      setError('')
      const res = await updateTrainingVideo(editingVideoId, {
        url: editVideoUrl,
        title: editVideoTitle || null,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setEditingVideoId(null)
      setMessage('Video updated')
      load()
    })
  }

  const removeVideo = (videoId: string) => {
    if (!confirm('Remove this video from the module?')) return
    startTransition(async () => {
      const res = await deleteTrainingVideo(videoId)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setMessage('Video removed')
      load()
    })
  }

  return (
    <section className="crm-card overflow-hidden">
      <div className="border-b border-line bg-gradient-to-r from-[var(--sunrise-soft)]/40 to-surface px-4 py-4">
        <h3 className="font-display text-lg font-semibold text-ink">
          Training content editor
        </h3>
        <p className="mt-1 text-sm text-quiet">
          Edit what each role sees in their Profile training tab. Changes apply
          immediately for all staff.
        </p>
      </div>

      <div className="space-y-4 p-4">
        {(error || message) && (
          <p
            className={cn(
              'text-sm',
              error ? 'text-[var(--urgent)]' : 'text-[var(--green)]'
            )}
          >
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
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-line bg-[var(--bg)] p-4">
              <h4 className="font-display text-sm font-semibold text-ink">
                Edit module
              </h4>
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
                <h4 className="font-display text-sm font-semibold text-ink">
                  Steps
                </h4>
                <button
                  type="button"
                  onClick={addStep}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs hover:bg-line-2"
                >
                  <Plus className="h-3 w-3" /> Add step
                </button>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={selected.steps.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-2">
                    {selected.steps.map((step) => (
                      <SortableStepRow
                        key={step.id}
                        step={step}
                        pending={pending}
                        editingStepId={editingStepId}
                        editTitle={editTitle}
                        editBody={editBody}
                        setEditTitle={setEditTitle}
                        setEditBody={setEditBody}
                        onStartEdit={startEditStep}
                        onSave={saveStep}
                        onCancelEdit={() => setEditingStepId(null)}
                        onDelete={removeStep}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>

              <div className="space-y-3 border-t border-line pt-4">
                <h4 className="font-display text-sm font-semibold text-ink">
                  Videos &amp; Guides
                </h4>
                <p className="text-xs text-quiet">
                  Paste YouTube links to embed in the staff training tab.
                </p>
                <div className="space-y-2 rounded-lg border border-line bg-surface p-3">
                  <label className="block text-xs text-quiet">
                    YouTube URL
                    <input
                      value={videoUrl}
                      onChange={(e) => {
                        setVideoUrl(e.target.value)
                        setVideoUrlError('')
                      }}
                      placeholder="https://youtu.be/… or youtube.com/watch?v=…"
                      className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="block text-xs text-quiet">
                    Title (optional)
                    <input
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="e.g. Intake walkthrough"
                      className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm"
                    />
                  </label>
                  {videoUrlError && (
                    <p className="text-xs text-[var(--urgent)]">{videoUrlError}</p>
                  )}
                  <button
                    type="button"
                    disabled={pending || !videoUrl.trim()}
                    onClick={addVideo}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-[var(--espresso)] px-3 text-xs font-medium text-white disabled:opacity-50"
                  >
                    <Plus className="h-3 w-3" /> Add video
                  </button>
                </div>

                <ul className="space-y-2">
                  {selected.videos.map((video) => (
                    <li
                      key={video.id}
                      className="rounded-lg border border-line bg-surface p-2"
                    >
                      {editingVideoId === video.id ? (
                        <div className="space-y-2">
                          <input
                            value={editVideoUrl}
                            onChange={(e) => setEditVideoUrl(e.target.value)}
                            className="w-full rounded border border-line px-2 py-1 text-sm"
                          />
                          <input
                            value={editVideoTitle}
                            onChange={(e) => setEditVideoTitle(e.target.value)}
                            placeholder="Title"
                            className="w-full rounded border border-line px-2 py-1 text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={saveVideo}
                              disabled={pending}
                              className="rounded bg-[var(--sunrise-dark)] px-2 py-1 text-xs text-white"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingVideoId(null)}
                              className="rounded border border-line px-2 py-1 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={youtubeThumbnailUrl(video.videoId)}
                            alt=""
                            className="h-14 w-24 shrink-0 rounded object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">
                              {video.title || 'Untitled video'}
                            </p>
                            <p className="truncate text-xs text-quiet">
                              {video.url}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              onClick={() => startEditVideo(video)}
                              className="rounded p-1 hover:bg-line-2"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeVideo(video.id)}
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
            </div>

            <div>
              <h4 className="mb-2 font-display text-sm font-semibold text-ink">
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
