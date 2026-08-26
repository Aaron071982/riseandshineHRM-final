'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import type { OrgTrainingItemType, Prisma } from '@prisma/client'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'
import { getClientIpFromHeaders } from '@/lib/client-ip'
import { prisma } from '@/lib/prisma'
import { canAuthorOrgTraining } from '@/lib/org-training/access'
import {
  moduleAssignedToUser,
  sanitizeAudienceRoles,
  userAudienceKeys,
} from '@/lib/org-training/audience'
import { loadModuleDetail } from '@/lib/org-training/load'
import type { OrgTrainingQuizQuestion } from '@/lib/org-training/types'
import { toYouTubeNoCookieEmbed } from '@/lib/org-training/youtube'
import { fetchUserCrmRoles, getClientServicesUser } from '@/lib/crm/access'

export type OrgTrainingActionResult<T = void> =
  | ({ ok: true } & (T extends void ? object : { data: T }))
  | { ok: false; error: string }

async function requireAuthor() {
  const user = await getCurrentUser()
  if (!user) return { user: null as null, error: 'Forbidden' as const }
  if (canAuthorOrgTraining(user)) return { user, error: null }

  try {
    const crm = await getClientServicesUser()
    if (canAuthorOrgTraining(user, crm)) return { user, error: null }
  } catch {
    // not a CRM session
  }

  return { user: null as null, error: 'Forbidden' as const }
}

function revalidateTrainingPaths(moduleId?: string) {
  revalidatePath('/admin/training')
  revalidatePath('/admin/training/matrix')
  revalidatePath('/client-services/training')
  revalidatePath('/client-services/training/matrix')
  revalidatePath('/rbt/org-training')
  revalidatePath('/rbt/profile')
  revalidatePath('/rbt/dashboard')
  if (moduleId) {
    revalidatePath(`/admin/training/${moduleId}`)
    revalidatePath(`/client-services/training/manage/${moduleId}`)
    revalidatePath(`/rbt/org-training/${moduleId}`)
    revalidatePath(`/client-services/training/${moduleId}`)
  }
}

export async function createOrgTrainingModule(input: {
  title: string
  description?: string | null
  audienceRoles?: string[]
  required?: boolean
  displayOrder?: number
}): Promise<OrgTrainingActionResult<{ id: string }>> {
  const { user, error } = await requireAuthor()
  if (error || !user) return { ok: false, error: error ?? 'Forbidden' }

  const title = input.title?.trim()
  if (!title) return { ok: false, error: 'Title is required' }

  const audienceRoles = sanitizeAudienceRoles(input.audienceRoles ?? [])
  const created = await prisma.orgTrainingModule.create({
    data: {
      title,
      description: input.description?.trim() || null,
      audienceRoles,
      required: input.required ?? true,
      displayOrder: input.displayOrder ?? 0,
      status: 'ACTIVE',
      createdByUserId: user.id,
    },
  })

  await writeAuditLog({
    actorUserId: user.id,
    entityType: 'OrgTrainingModule',
    entityId: created.id,
    action: 'CREATE',
    after: {
      title: created.title,
      audienceRoles: created.audienceRoles,
      required: created.required,
    },
  })

  revalidateTrainingPaths(created.id)
  return { ok: true, data: { id: created.id } }
}

export async function updateOrgTrainingModule(
  moduleId: string,
  input: {
    title?: string
    description?: string | null
    audienceRoles?: string[]
    required?: boolean
    displayOrder?: number
  }
): Promise<OrgTrainingActionResult> {
  const { user, error } = await requireAuthor()
  if (error || !user) return { ok: false, error: error ?? 'Forbidden' }

  const existing = await prisma.orgTrainingModule.findUnique({
    where: { id: moduleId },
  })
  if (!existing) return { ok: false, error: 'Module not found' }

  const data: Prisma.OrgTrainingModuleUpdateInput = {}
  if (input.title !== undefined) {
    const title = input.title.trim()
    if (!title) return { ok: false, error: 'Title is required' }
    data.title = title
  }
  if (input.description !== undefined) {
    data.description = input.description?.trim() || null
  }
  if (input.audienceRoles !== undefined) {
    data.audienceRoles = sanitizeAudienceRoles(input.audienceRoles)
  }
  if (input.required !== undefined) data.required = input.required
  if (input.displayOrder !== undefined) data.displayOrder = input.displayOrder

  const updated = await prisma.orgTrainingModule.update({
    where: { id: moduleId },
    data,
  })

  await writeAuditLog({
    actorUserId: user.id,
    entityType: 'OrgTrainingModule',
    entityId: moduleId,
    action: 'UPDATE',
    before: {
      title: existing.title,
      audienceRoles: existing.audienceRoles,
      required: existing.required,
    },
    after: {
      title: updated.title,
      audienceRoles: updated.audienceRoles,
      required: updated.required,
    },
  })

  revalidateTrainingPaths(moduleId)
  return { ok: true }
}

export async function setOrgTrainingModuleStatus(
  moduleId: string,
  status: 'ACTIVE' | 'ARCHIVED'
): Promise<OrgTrainingActionResult> {
  const { user, error } = await requireAuthor()
  if (error || !user) return { ok: false, error: error ?? 'Forbidden' }

  const existing = await prisma.orgTrainingModule.findUnique({
    where: { id: moduleId },
    select: { id: true, status: true },
  })
  if (!existing) return { ok: false, error: 'Module not found' }

  await prisma.orgTrainingModule.update({
    where: { id: moduleId },
    data: { status },
  })

  await writeAuditLog({
    actorUserId: user.id,
    entityType: 'OrgTrainingModule',
    entityId: moduleId,
    action: 'UPDATE',
    before: { status: existing.status },
    after: { status },
  })

  revalidateTrainingPaths(moduleId)
  return { ok: true }
}

export type OrgTrainingItemInput = {
  id?: string
  type: OrgTrainingItemType
  title: string
  embedUrl?: string | null
  externalUrl?: string | null
  storageObjectPath?: string | null
  richTextContent?: string | null
}

export async function upsertOrgTrainingItems(
  moduleId: string,
  items: OrgTrainingItemInput[]
): Promise<OrgTrainingActionResult> {
  const { user, error } = await requireAuthor()
  if (error || !user) return { ok: false, error: error ?? 'Forbidden' }

  const existing = await prisma.orgTrainingModule.findUnique({
    where: { id: moduleId },
    select: { id: true },
  })
  if (!existing) return { ok: false, error: 'Module not found' }

  const normalized: {
    id?: string
    type: OrgTrainingItemType
    title: string
    position: number
    embedUrl: string | null
    externalUrl: string | null
    storageObjectPath: string | null
    richTextContent: string | null
  }[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const title = item.title?.trim()
    if (!title) return { ok: false, error: `Item ${i + 1}: title required` }

    let embedUrl: string | null = null
    let externalUrl: string | null = null
    let storageObjectPath: string | null = null
    let richTextContent: string | null = null

    if (item.type === 'VIDEO_EMBED') {
      const raw = item.embedUrl?.trim() || ''
      const converted = toYouTubeNoCookieEmbed(raw)
      if (!converted) {
        return {
          ok: false,
          error: `Item ${i + 1}: valid YouTube URL required`,
        }
      }
      embedUrl = converted
    } else if (item.type === 'EXTERNAL_LINK') {
      const url = item.externalUrl?.trim() || ''
      if (!url || !/^https?:\/\//i.test(url)) {
        return {
          ok: false,
          error: `Item ${i + 1}: external URL must start with http(s)`,
        }
      }
      externalUrl = url
    } else if (item.type === 'FILE') {
      const path = item.storageObjectPath?.trim() || ''
      if (!path) {
        return { ok: false, error: `Item ${i + 1}: file upload required` }
      }
      storageObjectPath = path
    } else if (item.type === 'READING') {
      richTextContent = item.richTextContent?.trim() || ''
      if (!richTextContent) {
        return { ok: false, error: `Item ${i + 1}: reading content required` }
      }
    } else {
      return { ok: false, error: `Item ${i + 1}: invalid type` }
    }

    normalized.push({
      id: item.id,
      type: item.type,
      title,
      position: i,
      embedUrl,
      externalUrl,
      storageObjectPath,
      richTextContent,
    })
  }

  const keepIds = normalized.map((n) => n.id).filter(Boolean) as string[]

  await prisma.$transaction(async (tx) => {
    await tx.orgTrainingModuleItem.deleteMany({
      where: {
        moduleId,
        ...(keepIds.length ? { id: { notIn: keepIds } } : {}),
      },
    })

    for (const n of normalized) {
      if (n.id) {
        await tx.orgTrainingModuleItem.update({
          where: { id: n.id },
          data: {
            type: n.type,
            title: n.title,
            position: n.position,
            embedUrl: n.embedUrl,
            externalUrl: n.externalUrl,
            storageObjectPath: n.storageObjectPath,
            richTextContent: n.richTextContent,
          },
        })
      } else {
        await tx.orgTrainingModuleItem.create({
          data: {
            moduleId,
            type: n.type,
            title: n.title,
            position: n.position,
            embedUrl: n.embedUrl,
            externalUrl: n.externalUrl,
            storageObjectPath: n.storageObjectPath,
            richTextContent: n.richTextContent,
          },
        })
      }
    }
  })

  await writeAuditLog({
    actorUserId: user.id,
    entityType: 'OrgTrainingModule',
    entityId: moduleId,
    action: 'UPDATE',
    after: { itemsCount: normalized.length },
  })

  revalidateTrainingPaths(moduleId)
  return { ok: true }
}

function normalizeQuizQuestions(
  questions: OrgTrainingQuizQuestion[]
): OrgTrainingQuizQuestion[] | { error: string } {
  if (!questions.length) return { error: 'At least one quiz question required' }
  const out: OrgTrainingQuizQuestion[] = []
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const prompt = q.prompt?.trim()
    if (!prompt) return { error: `Question ${i + 1}: prompt required` }
    const options = (q.options ?? []).map((o) => o.trim()).filter(Boolean)
    if (options.length < 2) {
      return { error: `Question ${i + 1}: at least 2 options required` }
    }
    if (
      typeof q.correctIndex !== 'number' ||
      q.correctIndex < 0 ||
      q.correctIndex >= options.length
    ) {
      return { error: `Question ${i + 1}: invalid correct answer` }
    }
    out.push({
      id: q.id?.trim() || `q${i + 1}`,
      prompt,
      options,
      correctIndex: q.correctIndex,
    })
  }
  return out
}

export async function upsertOrgTrainingQuiz(
  moduleId: string,
  input: {
    questions: OrgTrainingQuizQuestion[]
    passThreshold: number
  } | null
): Promise<OrgTrainingActionResult> {
  const { user, error } = await requireAuthor()
  if (error || !user) return { ok: false, error: error ?? 'Forbidden' }

  const existing = await prisma.orgTrainingModule.findUnique({
    where: { id: moduleId },
    select: { id: true },
  })
  if (!existing) return { ok: false, error: 'Module not found' }

  if (input === null) {
    await prisma.orgTrainingQuiz.deleteMany({ where: { moduleId } })
    await writeAuditLog({
      actorUserId: user.id,
      entityType: 'OrgTrainingQuiz',
      entityId: moduleId,
      action: 'DELETE',
    })
    revalidateTrainingPaths(moduleId)
    return { ok: true }
  }

  const questions = normalizeQuizQuestions(input.questions)
  if ('error' in questions) return { ok: false, error: questions.error }

  const passThreshold = Math.max(
    1,
    Math.min(questions.length, Math.trunc(input.passThreshold) || 1)
  )

  await prisma.orgTrainingQuiz.upsert({
    where: { moduleId },
    create: {
      moduleId,
      questionsJson: questions,
      passThreshold,
    },
    update: {
      questionsJson: questions,
      passThreshold,
    },
  })

  await writeAuditLog({
    actorUserId: user.id,
    entityType: 'OrgTrainingQuiz',
    entityId: moduleId,
    action: 'UPDATE',
    after: { questionCount: questions.length, passThreshold },
  })

  revalidateTrainingPaths(moduleId)
  return { ok: true }
}

async function assertCanCompleteModule(moduleId: string, userId: string) {
  const user = await getCurrentUser()
  if (!user || user.id !== userId) {
    return { error: 'Unauthorized' as const, module: null, user: null }
  }

  const trainingModule = await loadModuleDetail(moduleId)
  if (!trainingModule || trainingModule.status !== 'ACTIVE') {
    return { error: 'Module not found' as const, module: null, user: null }
  }

  // Admins may preview but completion is for assigned audience only
  const crmRoles = await fetchUserCrmRoles(user.id)
  const keys = userAudienceKeys({ role: user.role, crmRoles })
  if (!moduleAssignedToUser(trainingModule, keys) && !isAdmin(user)) {
    return { error: 'Not assigned to this module' as const, module: null, user: null }
  }
  // Admins who aren't in audience shouldn't write completion via this path unless assigned
  if (!moduleAssignedToUser(trainingModule, keys)) {
    return { error: 'Not assigned to this module' as const, module: null, user: null }
  }

  return { error: null, module: trainingModule, user }
}

async function requestMeta() {
  const hdrs = await headers()
  return {
    ipAddress: getClientIpFromHeaders(hdrs),
    userAgent: hdrs.get('user-agent'),
  }
}

export async function attestOrgTrainingComplete(
  moduleId: string,
  attestationText?: string
): Promise<OrgTrainingActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const check = await assertCanCompleteModule(moduleId, user.id)
  if (check.error || !check.module || !check.user) {
    return { ok: false, error: check.error ?? 'Forbidden' }
  }

  if (check.module.quiz) {
    return {
      ok: false,
      error: 'This module requires a quiz — submit the quiz to complete',
    }
  }

  const existing = await prisma.orgTrainingCompletion.findUnique({
    where: { moduleId_userId: { moduleId, userId: user.id } },
  })
  if (existing) return { ok: true }

  const meta = await requestMeta()
  const text =
    attestationText?.trim() ||
    `I attest that I have completed the training module "${check.module.title}".`

  await prisma.orgTrainingCompletion.create({
    data: {
      moduleId,
      userId: user.id,
      evidenceType: 'ATTESTATION',
      attestationText: text,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  })

  await writeAuditLog({
    actorUserId: user.id,
    entityType: 'OrgTrainingCompletion',
    entityId: moduleId,
    action: 'CREATE',
    after: { evidenceType: 'ATTESTATION', userId: user.id },
  })

  revalidateTrainingPaths(moduleId)
  return { ok: true }
}

export async function submitOrgTrainingQuiz(
  moduleId: string,
  answers: Record<string, number>
): Promise<
  OrgTrainingActionResult<{
    score: number
    passThreshold: number
    passed: boolean
  }>
> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const check = await assertCanCompleteModule(moduleId, user.id)
  if (check.error || !check.module || !check.user) {
    return { ok: false, error: check.error ?? 'Forbidden' }
  }

  const quiz = check.module.quiz
  if (!quiz) return { ok: false, error: 'This module has no quiz' }

  let score = 0
  for (const q of quiz.questions) {
    const ans = answers[q.id]
    if (typeof ans === 'number' && ans === q.correctIndex) score += 1
  }

  const passed = score >= quiz.passThreshold
  if (!passed) {
    return {
      ok: true,
      data: { score, passThreshold: quiz.passThreshold, passed: false },
    }
  }

  const existing = await prisma.orgTrainingCompletion.findUnique({
    where: { moduleId_userId: { moduleId, userId: user.id } },
  })
  if (!existing) {
    const meta = await requestMeta()
    await prisma.orgTrainingCompletion.create({
      data: {
        moduleId,
        userId: user.id,
        evidenceType: 'QUIZ_PASS',
        quizScore: score,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    })
    await writeAuditLog({
      actorUserId: user.id,
      entityType: 'OrgTrainingCompletion',
      entityId: moduleId,
      action: 'CREATE',
      after: { evidenceType: 'QUIZ_PASS', score, userId: user.id },
    })
  }

  revalidateTrainingPaths(moduleId)
  return {
    ok: true,
    data: { score, passThreshold: quiz.passThreshold, passed: true },
  }
}
