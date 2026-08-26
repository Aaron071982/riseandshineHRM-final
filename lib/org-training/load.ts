import type {
  OrgTrainingEvidenceType,
  OrgTrainingItemType,
  OrgTrainingModuleStatus,
  Prisma,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  moduleAssignedToUser,
  userAudienceKeys,
  type AudienceUser,
} from '@/lib/org-training/audience'
import type { OrgTrainingQuizQuestion } from '@/lib/org-training/types'

export type { OrgTrainingQuizQuestion } from '@/lib/org-training/types'

export type OrgTrainingModuleListItem = {
  id: string
  title: string
  description: string | null
  audienceRoles: string[]
  required: boolean
  status: OrgTrainingModuleStatus
  displayOrder: number
  itemCount: number
  hasQuiz: boolean
  completionCount: number
  createdAt: Date
  updatedAt: Date
}

export type OrgTrainingModuleDetail = {
  id: string
  title: string
  description: string | null
  audienceRoles: string[]
  required: boolean
  status: OrgTrainingModuleStatus
  displayOrder: number
  createdAt: Date
  updatedAt: Date
  items: {
    id: string
    type: OrgTrainingItemType
    title: string
    position: number
    embedUrl: string | null
    externalUrl: string | null
    storageObjectPath: string | null
    richTextContent: string | null
  }[]
  quiz: {
    id: string
    questions: OrgTrainingQuizQuestion[]
    passThreshold: number
  } | null
}

export type OrgTrainingAssignedModule = OrgTrainingModuleListItem & {
  completed: boolean
  completedAt: Date | null
  evidenceType: OrgTrainingEvidenceType | null
}

const moduleListSelect = {
  id: true,
  title: true,
  description: true,
  audienceRoles: true,
  required: true,
  status: true,
  displayOrder: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { items: true, completions: true } },
  quiz: { select: { id: true } },
} satisfies Prisma.OrgTrainingModuleSelect

function mapListRow(
  m: Prisma.OrgTrainingModuleGetPayload<{ select: typeof moduleListSelect }>
): OrgTrainingModuleListItem {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    audienceRoles: m.audienceRoles,
    required: m.required,
    status: m.status,
    displayOrder: m.displayOrder,
    itemCount: m._count.items,
    hasQuiz: !!m.quiz,
    completionCount: m._count.completions,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  }
}

export async function listModulesForAdmin(opts?: {
  includeArchived?: boolean
}): Promise<OrgTrainingModuleListItem[]> {
  const rows = await prisma.orgTrainingModule.findMany({
    where: opts?.includeArchived ? undefined : { status: 'ACTIVE' },
    orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
    select: moduleListSelect,
  })
  return rows.map(mapListRow)
}

export async function listAllModulesForAdmin(): Promise<OrgTrainingModuleListItem[]> {
  const rows = await prisma.orgTrainingModule.findMany({
    orderBy: [{ status: 'asc' }, { displayOrder: 'asc' }, { title: 'asc' }],
    select: moduleListSelect,
  })
  return rows.map(mapListRow)
}

function parseQuizQuestions(raw: unknown): OrgTrainingQuizQuestion[] {
  if (!Array.isArray(raw)) return []
  const out: OrgTrainingQuizQuestion[] = []
  for (const q of raw) {
    if (!q || typeof q !== 'object') continue
    const rec = q as Record<string, unknown>
    const id = typeof rec.id === 'string' ? rec.id : ''
    const prompt = typeof rec.prompt === 'string' ? rec.prompt : ''
    const options = Array.isArray(rec.options)
      ? rec.options.filter((o): o is string => typeof o === 'string')
      : []
    const correctIndex =
      typeof rec.correctIndex === 'number' && Number.isFinite(rec.correctIndex)
        ? Math.trunc(rec.correctIndex)
        : -1
    if (!id || !prompt || options.length < 2 || correctIndex < 0) continue
    out.push({ id, prompt, options, correctIndex })
  }
  return out
}

export async function loadModuleDetail(
  moduleId: string
): Promise<OrgTrainingModuleDetail | null> {
  const m = await prisma.orgTrainingModule.findUnique({
    where: { id: moduleId },
    include: {
      items: { orderBy: { position: 'asc' } },
      quiz: true,
    },
  })
  if (!m) return null
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    audienceRoles: m.audienceRoles,
    required: m.required,
    status: m.status,
    displayOrder: m.displayOrder,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    items: m.items.map((i) => ({
      id: i.id,
      type: i.type,
      title: i.title,
      position: i.position,
      embedUrl: i.embedUrl,
      externalUrl: i.externalUrl,
      storageObjectPath: i.storageObjectPath,
      richTextContent: i.richTextContent,
    })),
    quiz: m.quiz
      ? {
          id: m.quiz.id,
          questions: parseQuizQuestions(m.quiz.questionsJson),
          passThreshold: m.quiz.passThreshold,
        }
      : null,
  }
}

export async function listAssignedModulesForUser(
  user: AudienceUser & { id: string }
): Promise<OrgTrainingAssignedModule[]> {
  const keys = userAudienceKeys(user)
  const modules = await prisma.orgTrainingModule.findMany({
    where: { status: 'ACTIVE' },
    orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
    select: moduleListSelect,
  })
  const assigned = modules.filter((m) => moduleAssignedToUser(m, keys))
  if (assigned.length === 0) return []

  const completions = await prisma.orgTrainingCompletion.findMany({
    where: {
      userId: user.id,
      moduleId: { in: assigned.map((m) => m.id) },
    },
    select: {
      moduleId: true,
      completedAt: true,
      evidenceType: true,
    },
  })
  const byModule = new Map(completions.map((c) => [c.moduleId, c]))

  return assigned.map((m) => {
    const c = byModule.get(m.id)
    return {
      ...mapListRow(m),
      completed: !!c,
      completedAt: c?.completedAt ?? null,
      evidenceType: c?.evidenceType ?? null,
    }
  })
}

export async function getCompletionStatus(
  moduleId: string,
  userId: string
): Promise<{
  completed: boolean
  completedAt: Date | null
  evidenceType: OrgTrainingEvidenceType | null
  quizScore: number | null
} | null> {
  const c = await prisma.orgTrainingCompletion.findUnique({
    where: { moduleId_userId: { moduleId, userId } },
    select: {
      completedAt: true,
      evidenceType: true,
      quizScore: true,
    },
  })
  if (!c) {
    return {
      completed: false,
      completedAt: null,
      evidenceType: null,
      quizScore: null,
    }
  }
  return {
    completed: true,
    completedAt: c.completedAt,
    evidenceType: c.evidenceType,
    quizScore: c.quizScore,
  }
}

export { sanitizeReadingHtml } from '@/lib/org-training/sanitize'
