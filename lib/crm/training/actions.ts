'use server'

import { revalidatePath } from 'next/cache'
import type { CrmRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import {
  auditClientAction,
  CrmAccessError,
  getClientServicesUser,
  rethrowIfNextControlFlow,
} from '@/lib/crm/access'
import {
  assertCanEditTrainingContent,
  assertCanToggleTrainingCompletion,
} from '@/lib/crm/training/access'
import {
  ensureCrmTrainingModules,
  renumberModuleSteps,
  trainingRolesForUser,
} from '@/lib/crm/training/ensureModules'

export type TrainingActionResult<T = void> =
  | ({ ok: true } & (T extends void ? object : T))
  | { ok: false; error: string; status?: number }

function fail(err: unknown): TrainingActionResult<never> {
  rethrowIfNextControlFlow(err)
  if (err instanceof CrmAccessError) {
    return { ok: false, error: err.message, status: err.status }
  }
  console.error('[crm-training]', err)
  return {
    ok: false,
    error: err instanceof Error ? err.message : 'Something went wrong',
    status: 500,
  }
}

function revalidateProfilePaths(userId?: string) {
  revalidatePath('/client-services/profile')
  if (userId) revalidatePath(`/client-services/profile/${userId}`)
  revalidatePath('/client-services/admin')
}

export async function toggleTrainingStepCompletion(
  stepId: string,
  completed: boolean,
  targetUserId?: string
): Promise<TrainingActionResult> {
  try {
    const viewer = await getClientServicesUser()
    const userId = targetUserId ?? viewer.id
    assertCanToggleTrainingCompletion(viewer, userId)

    const step = await prisma.crmTrainingStep.findUnique({
      where: { id: stepId },
      select: { id: true, title: true },
    })
    if (!step) return { ok: false, error: 'Step not found', status: 404 }

    if (completed) {
      await prisma.crmTrainingStepCompletion.upsert({
        where: { userId_stepId: { userId, stepId } },
        create: { userId, stepId },
        update: {},
      })
    } else {
      await prisma.crmTrainingStepCompletion.deleteMany({
        where: { userId, stepId },
      })
    }

    await auditClientAction({
      userId: viewer.id,
      action: completed
        ? `TRAINING_STEP_COMPLETE:${stepId}`
        : `TRAINING_STEP_UNCOMPLETE:${stepId}`,
    })

    revalidateProfilePaths(userId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function updateTrainingModule(
  moduleId: string,
  data: {
    title?: string
    summary?: string | null
    goalStatement?: string | null
  }
): Promise<TrainingActionResult> {
  try {
    const viewer = await getClientServicesUser()
    assertCanEditTrainingContent(viewer)

    await prisma.crmTrainingModule.update({
      where: { id: moduleId },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.summary !== undefined ? { summary: data.summary } : {}),
        ...(data.goalStatement !== undefined
          ? { goalStatement: data.goalStatement }
          : {}),
      },
    })

    await writeAuditLog({
      actorUserId: viewer.id,
      entityType: 'CrmTrainingModule',
      entityId: moduleId,
      action: 'UPDATE',
      after: data,
    })

    revalidateProfilePaths()
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function updateTrainingStep(
  stepId: string,
  data: {
    title?: string
    body?: string
    icon?: string | null
    stepNumber?: number
  }
): Promise<TrainingActionResult> {
  try {
    const viewer = await getClientServicesUser()
    assertCanEditTrainingContent(viewer)

    await prisma.crmTrainingStep.update({
      where: { id: stepId },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.icon !== undefined ? { icon: data.icon } : {}),
        ...(data.stepNumber !== undefined ? { stepNumber: data.stepNumber } : {}),
      },
    })

    await writeAuditLog({
      actorUserId: viewer.id,
      entityType: 'CrmTrainingStep',
      entityId: stepId,
      action: 'UPDATE',
      after: data,
    })

    revalidateProfilePaths()
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function createTrainingStep(
  moduleId: string,
  data: { title: string; body: string; icon?: string | null }
): Promise<TrainingActionResult<{ stepId: string }>> {
  try {
    const viewer = await getClientServicesUser()
    assertCanEditTrainingContent(viewer)

    const mod = await prisma.crmTrainingModule.findUnique({
      where: { id: moduleId },
      select: { id: true, crmRole: true },
    })
    if (!mod) return { ok: false, error: 'Module not found', status: 404 }

    const agg = await prisma.crmTrainingStep.aggregate({
      where: { moduleId },
      _max: { stepNumber: true },
    })
    // Prefer positive next index; if mid-renumber negatives exist, append after abs max.
    const maxNum = agg._max.stepNumber ?? 0
    const nextNum = Math.max(maxNum, 0) + 1
    const slug = `${mod.crmRole.toLowerCase()}-custom-${Date.now()}`

    const step = await prisma.crmTrainingStep.create({
      data: {
        moduleId,
        stepNumber: nextNum,
        slug,
        title: data.title.trim(),
        body: data.body,
        icon: data.icon ?? null,
      },
    })

    await writeAuditLog({
      actorUserId: viewer.id,
      entityType: 'CrmTrainingStep',
      entityId: step.id,
      action: 'CREATE',
      after: { moduleId, title: data.title },
    })

    revalidateProfilePaths()
    return { ok: true, stepId: step.id }
  } catch (err) {
    return fail(err) as TrainingActionResult<{ stepId: string }>
  }
}

export async function deleteTrainingStep(
  stepId: string
): Promise<TrainingActionResult> {
  try {
    const viewer = await getClientServicesUser()
    assertCanEditTrainingContent(viewer)

    const existing = await prisma.crmTrainingStep.findUnique({
      where: { id: stepId },
      select: { id: true, moduleId: true },
    })
    if (!existing) return { ok: false, error: 'Step not found', status: 404 }

    await prisma.$transaction(async (tx) => {
      await tx.crmTrainingStep.delete({ where: { id: stepId } })

      const remaining = await tx.crmTrainingStep.findMany({
        where: { moduleId: existing.moduleId },
        orderBy: { stepNumber: 'asc' },
        select: { id: true },
      })
      await renumberModuleSteps(
        existing.moduleId,
        remaining.map((s) => s.id),
        tx
      )
    })

    await writeAuditLog({
      actorUserId: viewer.id,
      entityType: 'CrmTrainingStep',
      entityId: stepId,
      action: 'DELETE',
    })

    revalidateProfilePaths()
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

/**
 * Persist a full ordered list of step IDs for a module.
 * Uses temporary negative stepNumbers to satisfy @@unique([moduleId, stepNumber]).
 */
export async function reorderTrainingSteps(
  moduleId: string,
  orderedStepIds: string[]
): Promise<TrainingActionResult> {
  try {
    const viewer = await getClientServicesUser()
    assertCanEditTrainingContent(viewer)

    if (!Array.isArray(orderedStepIds) || orderedStepIds.length === 0) {
      return { ok: false, error: 'orderedStepIds is required', status: 400 }
    }

    const steps = await prisma.crmTrainingStep.findMany({
      where: { moduleId },
      select: { id: true },
    })
    const existingIds = new Set(steps.map((s) => s.id))
    if (orderedStepIds.length !== existingIds.size) {
      return {
        ok: false,
        error: 'Step list does not match this module',
        status: 400,
      }
    }
    for (const id of orderedStepIds) {
      if (!existingIds.has(id)) {
        return { ok: false, error: 'Unknown step id for this module', status: 400 }
      }
    }

    await prisma.$transaction(async (tx) => {
      await renumberModuleSteps(moduleId, orderedStepIds, tx)
    })

    await writeAuditLog({
      actorUserId: viewer.id,
      entityType: 'CrmTrainingModule',
      entityId: moduleId,
      action: 'UPDATE',
      after: { reorderSteps: orderedStepIds },
    })

    revalidateProfilePaths()
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function addTrainingVideo(
  moduleId: string,
  data: { url: string; title?: string | null }
): Promise<TrainingActionResult<{ videoId: string }>> {
  try {
    const viewer = await getClientServicesUser()
    assertCanEditTrainingContent(viewer)

    const { extractYoutubeVideoId } = await import('@/lib/crm/training/youtube')
    const ytId = extractYoutubeVideoId(data.url)
    if (!ytId) {
      return {
        ok: false,
        error: 'Paste a valid YouTube link (watch, youtu.be, shorts, or embed)',
        status: 400,
      }
    }

    const mod = await prisma.crmTrainingModule.findUnique({
      where: { id: moduleId },
      select: { id: true },
    })
    if (!mod) return { ok: false, error: 'Module not found', status: 404 }

    const max = await prisma.crmTrainingVideo.aggregate({
      where: { moduleId },
      _max: { position: true },
    })
    const position = (max._max.position ?? -1) + 1

    const video = await prisma.crmTrainingVideo.create({
      data: {
        moduleId,
        url: data.url.trim(),
        videoId: ytId,
        title: data.title?.trim() || null,
        position,
      },
    })

    await writeAuditLog({
      actorUserId: viewer.id,
      entityType: 'CrmTrainingVideo',
      entityId: video.id,
      action: 'CREATE',
      after: { moduleId, videoId: ytId, url: data.url.trim() },
    })

    revalidateProfilePaths()
    return { ok: true, videoId: video.id }
  } catch (err) {
    return fail(err) as TrainingActionResult<{ videoId: string }>
  }
}

export async function updateTrainingVideo(
  videoId: string,
  data: { url?: string; title?: string | null }
): Promise<TrainingActionResult> {
  try {
    const viewer = await getClientServicesUser()
    assertCanEditTrainingContent(viewer)

    const existing = await prisma.crmTrainingVideo.findUnique({
      where: { id: videoId },
      select: { id: true },
    })
    if (!existing) return { ok: false, error: 'Video not found', status: 404 }

    const patch: {
      url?: string
      videoId?: string
      title?: string | null
    } = {}

    if (data.url !== undefined) {
      const { extractYoutubeVideoId } = await import('@/lib/crm/training/youtube')
      const ytId = extractYoutubeVideoId(data.url)
      if (!ytId) {
        return {
          ok: false,
          error: 'Paste a valid YouTube link (watch, youtu.be, shorts, or embed)',
          status: 400,
        }
      }
      patch.url = data.url.trim()
      patch.videoId = ytId
    }
    if (data.title !== undefined) {
      patch.title = data.title?.trim() || null
    }

    await prisma.crmTrainingVideo.update({
      where: { id: videoId },
      data: patch,
    })

    await writeAuditLog({
      actorUserId: viewer.id,
      entityType: 'CrmTrainingVideo',
      entityId: videoId,
      action: 'UPDATE',
      after: patch,
    })

    revalidateProfilePaths()
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function deleteTrainingVideo(
  videoId: string
): Promise<TrainingActionResult> {
  try {
    const viewer = await getClientServicesUser()
    assertCanEditTrainingContent(viewer)

    const existing = await prisma.crmTrainingVideo.findUnique({
      where: { id: videoId },
      select: { id: true, moduleId: true },
    })
    if (!existing) return { ok: false, error: 'Video not found', status: 404 }

    await prisma.crmTrainingVideo.delete({ where: { id: videoId } })

    const remaining = await prisma.crmTrainingVideo.findMany({
      where: { moduleId: existing.moduleId },
      orderBy: { position: 'asc' },
      select: { id: true },
    })
    await prisma.$transaction(
      remaining.map((v, i) =>
        prisma.crmTrainingVideo.update({
          where: { id: v.id },
          data: { position: i },
        })
      )
    )

    await writeAuditLog({
      actorUserId: viewer.id,
      entityType: 'CrmTrainingVideo',
      entityId: videoId,
      action: 'DELETE',
    })

    revalidateProfilePaths()
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function reorderTrainingVideos(
  moduleId: string,
  orderedVideoIds: string[]
): Promise<TrainingActionResult> {
  try {
    const viewer = await getClientServicesUser()
    assertCanEditTrainingContent(viewer)

    const videos = await prisma.crmTrainingVideo.findMany({
      where: { moduleId },
      select: { id: true },
    })
    const existingIds = new Set(videos.map((v) => v.id))
    if (orderedVideoIds.length !== existingIds.size) {
      return { ok: false, error: 'Video list does not match this module', status: 400 }
    }
    for (const id of orderedVideoIds) {
      if (!existingIds.has(id)) {
        return { ok: false, error: 'Unknown video id for this module', status: 400 }
      }
    }

    await prisma.$transaction(
      orderedVideoIds.map((id, i) =>
        prisma.crmTrainingVideo.update({
          where: { id },
          data: { position: i },
        })
      )
    )

    revalidateProfilePaths()
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function listAllTrainingModulesForEditor(): Promise<
  TrainingActionResult<{
    modules: Awaited<ReturnType<typeof loadEditorModules>>
  }>
> {
  try {
    const viewer = await getClientServicesUser()
    assertCanEditTrainingContent(viewer)
    await ensureCrmTrainingModules()
    const modules = await loadEditorModules()
    return { ok: true, modules }
  } catch (err) {
    return fail(err) as TrainingActionResult<{ modules: never[] }>
  }
}

async function loadEditorModules() {
  return prisma.crmTrainingModule.findMany({
    orderBy: { crmRole: 'asc' },
    include: {
      steps: { orderBy: { stepNumber: 'asc' } },
      videos: { orderBy: { position: 'asc' } },
    },
  })
}

type EditorModuleRow = Awaited<ReturnType<typeof loadEditorModules>>[number]

export async function getTrainingCompletionSummaries(
  userIds: string[]
): Promise<
  TrainingActionResult<{
    summaries: Record<
      string,
      { completedSteps: number; totalSteps: number; percent: number }
    >
  }>
> {
  try {
    const viewer = await getClientServicesUser()
    assertCanEditTrainingContent(viewer)
    await ensureCrmTrainingModules()

    const [modules, roleRows] = await Promise.all([
      prisma.crmTrainingModule.findMany({
        include: { steps: { select: { id: true } } },
      }),
      prisma.userCrmRole.findMany({
        where: { userId: { in: userIds }, revokedAt: null },
        select: { userId: true, role: true },
      }),
    ])

    const rolesByUser = new Map<string, CrmRole[]>()
    for (const row of roleRows) {
      if (!rolesByUser.has(row.userId)) rolesByUser.set(row.userId, [])
      rolesByUser.get(row.userId)!.push(row.role)
    }

    const stepIdsByUser = new Map<string, string[]>()
    for (const uid of userIds) {
      const roles = trainingRolesForUser(rolesByUser.get(uid) ?? [])
      const stepIds = modules
        .filter((m) => roles.includes(m.crmRole))
        .flatMap((m) => m.steps.map((s) => s.id))
      stepIdsByUser.set(uid, stepIds)
    }

    const allStepIds = [...new Set([...stepIdsByUser.values()].flat())]
    const completions = allStepIds.length
      ? await prisma.crmTrainingStepCompletion.findMany({
          where: { userId: { in: userIds }, stepId: { in: allStepIds } },
          select: { userId: true, stepId: true },
        })
      : []

    const byUser = new Map<string, Set<string>>()
    for (const c of completions) {
      if (!byUser.has(c.userId)) byUser.set(c.userId, new Set())
      byUser.get(c.userId)!.add(c.stepId)
    }

    const summaries: Record<
      string,
      { completedSteps: number; totalSteps: number; percent: number }
    > = {}
    for (const uid of userIds) {
      const relevant = stepIdsByUser.get(uid) ?? []
      const totalSteps = relevant.length
      const done =
        relevant.filter((id) => byUser.get(uid)?.has(id)).length ?? 0
      summaries[uid] = {
        completedSteps: done,
        totalSteps,
        percent: totalSteps ? Math.round((done / totalSteps) * 100) : 0,
      }
    }

    return { ok: true, summaries }
  } catch (err) {
    return fail(err) as TrainingActionResult<{ summaries: never }>
  }
}

export async function previewTrainingModuleForRole(
  crmRole: CrmRole
): Promise<TrainingActionResult<{ module: EditorModuleRow }>> {
  try {
    const viewer = await getClientServicesUser()
    assertCanEditTrainingContent(viewer)
    await ensureCrmTrainingModules()

    const row = await prisma.crmTrainingModule.findUnique({
      where: { crmRole },
      include: {
        steps: { orderBy: { stepNumber: 'asc' } },
        videos: { orderBy: { position: 'asc' } },
      },
    })
    if (!row) return { ok: false, error: 'Module not found', status: 404 }

    return { ok: true, module: row }
  } catch (err) {
    return fail(err) as TrainingActionResult<{ module: EditorModuleRow }>
  }
}
