'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { OrgTrainingItemType } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { ORG_TRAINING_AUDIENCE_OPTIONS } from '@/lib/org-training/audience'
import {
  setOrgTrainingModuleStatus,
  updateOrgTrainingModule,
  upsertOrgTrainingItems,
  upsertOrgTrainingQuiz,
  type OrgTrainingItemInput,
} from '@/lib/org-training/actions'
import type { OrgTrainingModuleDetail } from '@/lib/org-training/load'
import type { OrgTrainingQuizQuestion } from '@/lib/org-training/types'
import { sanitizeReadingHtml } from '@/lib/org-training/sanitize'
import {
  isYouTubeNoCookieEmbed,
  toYouTubeNoCookieEmbed,
} from '@/lib/org-training/youtube'
import { Loader2, Plus, Trash2, Upload } from 'lucide-react'

type ItemDraft = OrgTrainingItemInput & { clientKey: string }

type Props = {
  module: OrgTrainingModuleDetail
}

function newClientKey() {
  return `k-${Math.random().toString(36).slice(2, 10)}`
}

export default function OrgTrainingModuleEditor({ module }: Props) {
  const router = useRouter()
  const { showToast } = useToast()
  const [pending, startTransition] = useTransition()

  const [title, setTitle] = useState(module.title)
  const [description, setDescription] = useState(module.description ?? '')
  const [required, setRequired] = useState(module.required)
  const [audienceRoles, setAudienceRoles] = useState<string[]>(module.audienceRoles)
  const [status, setStatus] = useState(module.status)
  const [items, setItems] = useState<ItemDraft[]>(
    module.items.map((i) => ({
      clientKey: i.id,
      id: i.id,
      type: i.type,
      title: i.title,
      embedUrl: i.embedUrl,
      externalUrl: i.externalUrl,
      storageObjectPath: i.storageObjectPath,
      richTextContent: i.richTextContent,
    }))
  )
  const [hasQuiz, setHasQuiz] = useState(!!module.quiz)
  const [passThreshold, setPassThreshold] = useState(
    module.quiz?.passThreshold ?? 1
  )
  const [questions, setQuestions] = useState<OrgTrainingQuizQuestion[]>(
    module.quiz?.questions?.length
      ? module.quiz.questions
      : [
          {
            id: 'q1',
            prompt: '',
            options: ['', ''],
            correctIndex: 0,
          },
        ]
  )
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)

  const toggleAudience = (key: string) => {
    setAudienceRoles((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const saveMeta = () => {
    startTransition(async () => {
      const res = await updateOrgTrainingModule(module.id, {
        title,
        description,
        audienceRoles,
        required,
      })
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      showToast('Module saved', 'success')
      router.refresh()
    })
  }

  const saveItems = () => {
    startTransition(async () => {
      const payload: OrgTrainingItemInput[] = items.map((i) => ({
        id: i.id,
        type: i.type,
        title: i.title,
        embedUrl: i.embedUrl,
        externalUrl: i.externalUrl,
        storageObjectPath: i.storageObjectPath,
        richTextContent: i.richTextContent,
      }))
      const res = await upsertOrgTrainingItems(module.id, payload)
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      showToast('Items saved', 'success')
      router.refresh()
    })
  }

  const saveQuiz = () => {
    startTransition(async () => {
      const res = await upsertOrgTrainingQuiz(
        module.id,
        hasQuiz
          ? { questions, passThreshold: Math.trunc(passThreshold) || 1 }
          : null
      )
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      showToast(hasQuiz ? 'Quiz saved' : 'Quiz removed', 'success')
      router.refresh()
    })
  }

  const setModuleStatus = (next: 'ACTIVE' | 'ARCHIVED') => {
    startTransition(async () => {
      const res = await setOrgTrainingModuleStatus(module.id, next)
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      setStatus(next)
      showToast(next === 'ACTIVE' ? 'Module activated' : 'Module archived', 'success')
      router.refresh()
    })
  }

  const addItem = (type: OrgTrainingItemType) => {
    setItems((prev) => [
      ...prev,
      {
        clientKey: newClientKey(),
        type,
        title: '',
        embedUrl: '',
        externalUrl: '',
        storageObjectPath: '',
        richTextContent: '',
      },
    ])
  }

  const updateItem = (clientKey: string, patch: Partial<ItemDraft>) => {
    setItems((prev) =>
      prev.map((i) => (i.clientKey === clientKey ? { ...i, ...patch } : i))
    )
  }

  const removeItem = (clientKey: string) => {
    setItems((prev) => prev.filter((i) => i.clientKey !== clientKey))
  }

  const uploadFile = async (clientKey: string, file: File) => {
    setUploadingKey(clientKey)
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('moduleId', module.id)
      const res = await fetch('/api/admin/training/upload', {
        method: 'POST',
        body: form,
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Upload failed', 'error')
        return
      }
      updateItem(clientKey, { storageObjectPath: data.storageObjectPath })
      showToast('File uploaded', 'success')
    } finally {
      setUploadingKey(null)
    }
  }

  const previewItems = items.filter((i) => i.title.trim())

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
            Edit training module
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={status === 'ACTIVE' ? 'default' : 'outline'}>
              {status}
            </Badge>
            {required ? (
              <Badge variant="secondary">Required</Badge>
            ) : (
              <Badge variant="outline">Optional</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === 'ACTIVE' ? (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setModuleStatus('ARCHIVED')}
            >
              Archive
            </Button>
          ) : (
            <Button disabled={pending} onClick={() => setModuleStatus('ACTIVE')}>
              Activate
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="rounded border-gray-300"
            />
            Required for assigned roles
          </label>
          <div className="space-y-2">
            <Label>Audience</Label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ORG_TRAINING_AUDIENCE_OPTIONS.map((opt) => (
                <label
                  key={`${opt.group}-${opt.key}`}
                  className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-[var(--border-subtle)]"
                >
                  <input
                    type="checkbox"
                    checked={audienceRoles.includes(opt.key)}
                    onChange={() => toggleAudience(opt.key)}
                  />
                  <span>
                    {opt.label}
                    <span className="ml-1 text-xs text-gray-400">
                      ({opt.group})
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <Button onClick={saveMeta} disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save details
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Items</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => addItem('VIDEO_EMBED')}>
              <Plus className="mr-1 h-3 w-3" /> Video
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => addItem('EXTERNAL_LINK')}>
              <Plus className="mr-1 h-3 w-3" /> Link
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => addItem('FILE')}>
              <Plus className="mr-1 h-3 w-3" /> File / video
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => addItem('READING')}>
              <Plus className="mr-1 h-3 w-3" /> Reading
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.length === 0 ? (
            <p className="text-sm text-gray-500">No items yet.</p>
          ) : (
            items.map((item, idx) => (
              <div
                key={item.clientKey}
                className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-[var(--border-subtle)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">
                    {idx + 1}. {item.type}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeItem(item.clientKey)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
                <Input
                  placeholder="Item title"
                  value={item.title}
                  onChange={(e) =>
                    updateItem(item.clientKey, { title: e.target.value })
                  }
                />
                {item.type === 'VIDEO_EMBED' ? (
                  <div className="space-y-1">
                    <Input
                      placeholder="YouTube URL"
                      value={item.embedUrl ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value
                        const converted = toYouTubeNoCookieEmbed(raw)
                        updateItem(item.clientKey, {
                          embedUrl: converted ?? raw,
                        })
                      }}
                    />
                    <p className="text-xs text-gray-500">
                      Converts to youtube-nocookie.com/embed/…
                    </p>
                  </div>
                ) : null}
                {item.type === 'EXTERNAL_LINK' ? (
                  <Input
                    placeholder="https://…"
                    value={item.externalUrl ?? ''}
                    onChange={(e) =>
                      updateItem(item.clientKey, { externalUrl: e.target.value })
                    }
                  />
                ) : null}
                {item.type === 'FILE' ? (
                  <div className="space-y-2">
                    {item.storageObjectPath ? (
                      <p className="truncate text-xs text-gray-600">
                        {item.storageObjectPath}
                      </p>
                    ) : null}
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[#e36f1e]">
                      <Upload className="h-4 w-4" />
                      {uploadingKey === item.clientKey
                        ? 'Uploading…'
                        : 'Upload PDF, image, or video (mp4)'}
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt,.mp4,.webm,.mov,.m4v,application/pdf,video/mp4,video/webm,video/quicktime"
                        className="hidden"
                        disabled={uploadingKey === item.clientKey}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) void uploadFile(item.clientKey, f)
                        }}
                      />
                    </label>
                    <p className="text-xs text-gray-500">
                      Videos up to 200MB (raise Supabase bucket limit if upload fails).
                      YouTube links still use &quot;YouTube embed&quot; above.
                    </p>
                  </div>
                ) : null}
                {item.type === 'READING' ? (
                  <Textarea
                    rows={5}
                    placeholder="Reading content (HTML allowed lightly)"
                    value={item.richTextContent ?? ''}
                    onChange={(e) =>
                      updateItem(item.clientKey, {
                        richTextContent: e.target.value,
                      })
                    }
                  />
                ) : null}
              </div>
            ))
          )}
          <Button onClick={saveItems} disabled={pending}>
            Save items
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quiz (optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasQuiz}
              onChange={(e) => setHasQuiz(e.target.checked)}
            />
            Require quiz to complete (otherwise attestation)
          </label>
          {hasQuiz ? (
            <>
              <div className="space-y-2 max-w-xs">
                <Label htmlFor="passThreshold">Pass threshold (correct answers)</Label>
                <Input
                  id="passThreshold"
                  type="number"
                  min={1}
                  max={questions.length || 1}
                  value={passThreshold}
                  onChange={(e) => setPassThreshold(Number(e.target.value))}
                />
              </div>
              {questions.map((q, qi) => (
                <div
                  key={q.id}
                  className="space-y-2 rounded-lg border border-gray-200 p-4 dark:border-[var(--border-subtle)]"
                >
                  <div className="flex justify-between gap-2">
                    <Label>Question {qi + 1}</Label>
                    {questions.length > 1 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setQuestions((prev) => prev.filter((_, i) => i !== qi))
                        }
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    ) : null}
                  </div>
                  <Input
                    value={q.prompt}
                    placeholder="Prompt"
                    onChange={(e) =>
                      setQuestions((prev) =>
                        prev.map((row, i) =>
                          i === qi ? { ...row, prompt: e.target.value } : row
                        )
                      )
                    }
                  />
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${q.id}`}
                        checked={q.correctIndex === oi}
                        onChange={() =>
                          setQuestions((prev) =>
                            prev.map((row, i) =>
                              i === qi ? { ...row, correctIndex: oi } : row
                            )
                          )
                        }
                      />
                      <Input
                        value={opt}
                        placeholder={`Option ${oi + 1}`}
                        onChange={(e) =>
                          setQuestions((prev) =>
                            prev.map((row, i) => {
                              if (i !== qi) return row
                              const options = [...row.options]
                              options[oi] = e.target.value
                              return { ...row, options }
                            })
                          )
                        }
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setQuestions((prev) =>
                        prev.map((row, i) =>
                          i === qi
                            ? { ...row, options: [...row.options, ''] }
                            : row
                        )
                      )
                    }
                  >
                    Add option
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setQuestions((prev) => [
                    ...prev,
                    {
                      id: `q${prev.length + 1}`,
                      prompt: '',
                      options: ['', ''],
                      correctIndex: 0,
                    },
                  ])
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Add question
              </Button>
            </>
          ) : null}
          <div>
            <Button onClick={saveQuiz} disabled={pending}>
              Save quiz settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Preview only — does not activate the module or record completion.
          </p>
          <h2 className="text-lg font-semibold">{title || 'Untitled'}</h2>
          {description ? (
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{description}</p>
          ) : null}
          {previewItems.map((item) => (
            <div key={item.clientKey} className="rounded-md border p-3">
              <p className="mb-2 font-medium">{item.title}</p>
              {item.type === 'VIDEO_EMBED' &&
              item.embedUrl &&
              isYouTubeNoCookieEmbed(item.embedUrl) ? (
                <div className="aspect-video overflow-hidden rounded-md bg-black">
                  <iframe
                    title={item.title}
                    src={item.embedUrl}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : null}
              {item.type === 'EXTERNAL_LINK' && item.externalUrl ? (
                <a
                  href={item.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#e36f1e] underline"
                >
                  {item.externalUrl}
                </a>
              ) : null}
              {item.type === 'FILE' && item.storageObjectPath ? (
                <a
                  href={`/api/training/file/${item.storageObjectPath
                    .split('/')
                    .map(encodeURIComponent)
                    .join('/')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#e36f1e] underline"
                >
                  Open file
                </a>
              ) : null}
              {item.type === 'READING' && item.richTextContent ? (
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeReadingHtml(item.richTextContent),
                  }}
                />
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
