import {
  auditClientAction,
  canViewClientRecord,
  CrmAccessError,
  fetchUserCrmRoles,
  getClientServicesUser,
  isFullAccess,
  isSuperAdmin,
} from '@/lib/crm/access'
import { prisma } from '@/lib/prisma'
import { assertCanViewStaffProfile } from '@/lib/crm/training/access'
import {
  completionMapForUser,
  ensureCrmTrainingModules,
  listTrainingModulesForRoles,
  trainingRolesForUser,
} from '@/lib/crm/training/ensureModules'

export async function loadStaffProfile(targetUserId: string) {
  const viewer = await getClientServicesUser()
  assertCanViewStaffProfile(viewer, targetUserId)
  await ensureCrmTrainingModules()

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      profile: {
        select: {
          fullName: true,
          preferredName: true,
          phone: true,
          title: true,
          department: true,
          bio: true,
        },
      },
    },
  })
  if (!target) throw new CrmAccessError('User not found', 404)

  const crmRoles = await fetchUserCrmRoles(targetUserId)
  const trainingRoleList = trainingRolesForUser(crmRoles)

  const rawClaims = await prisma.clientClaim.findMany({
    where: { userId: targetUserId },
    orderBy: { claimedAt: 'desc' },
    include: {
      serviceClient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          clientCode: true,
          stage: true,
          currentOwnerDept: true,
          pipelineStatus: true,
          caseCoordinatorUserId: true,
        },
      },
      claimedBy: { select: { id: true, name: true, email: true } },
      releasedBy: { select: { id: true, name: true, email: true } },
    },
  })

  const viewerGrants =
    viewer.id === targetUserId || isFullAccess(viewer) || isSuperAdmin(viewer)
      ? null
      : await prisma.clientClaim.findMany({
          where: {
            userId: viewer.id,
            serviceClientId: { in: rawClaims.map((c) => c.serviceClientId) },
          },
          select: { serviceClientId: true },
        })
  const viewerGrantSet = new Set(
    viewerGrants?.map((g) => g.serviceClientId) ?? []
  )

  const mapClaim = (c: (typeof rawClaims)[number]) => {
    const hasGrant =
      isFullAccess(viewer) ||
      isSuperAdmin(viewer) ||
      viewer.id === targetUserId ||
      viewerGrantSet.has(c.serviceClientId)
    return {
      id: c.id,
      claimedAt: c.claimedAt,
      releasedAt: c.releasedAt,
      serviceClient: {
        id: c.serviceClient.id,
        firstName: c.serviceClient.firstName,
        lastName: c.serviceClient.lastName,
        clientCode: c.serviceClient.clientCode,
        stage: c.serviceClient.stage,
        currentOwnerDept: c.serviceClient.currentOwnerDept,
        pipelineStatus: c.serviceClient.pipelineStatus,
      },
      claimedBy: c.claimedBy,
      releasedBy: c.releasedBy,
      canViewClient: canViewClientRecord(viewer, {
        hasClaimGrant: hasGrant,
        caseCoordinatorUserId: c.serviceClient.caseCoordinatorUserId,
      }),
    }
  }

  const claimHistory = rawClaims.map(mapClaim)
  const activeClaims = claimHistory.filter((c) => !c.releasedAt)

  const modules = await listTrainingModulesForRoles(trainingRoleList)
  const allStepIds = modules.flatMap((m) => m.steps.map((s) => s.id))
  const completed = await completionMapForUser(targetUserId, allStepIds)

  const trainingModules = modules.map((m) => {
    const total = m.steps.length
    const done = m.steps.filter((s) => completed.has(s.id)).length
    return {
      id: m.id,
      crmRole: m.crmRole,
      title: m.title,
      summary: m.summary,
      goalStatement: m.goalStatement,
      completedCount: done,
      totalSteps: total,
      percent: total ? Math.round((done / total) * 100) : 0,
      steps: m.steps.map((s) => ({
        id: s.id,
        stepNumber: s.stepNumber,
        slug: s.slug,
        title: s.title,
        body: s.body,
        icon: s.icon,
        completed: completed.has(s.id),
      })),
      videos: m.videos.map((v) => ({
        id: v.id,
        url: v.url,
        videoId: v.videoId,
        title: v.title,
        position: v.position,
      })),
    }
  })

  await auditClientAction({
    userId: viewer.id,
    action:
      viewer.id === targetUserId
        ? 'STAFF_PROFILE_VIEW:self'
        : `STAFF_PROFILE_VIEW:${targetUserId}`,
  })

  return {
    viewer: {
      id: viewer.id,
      canEditTrainingContent: isFullAccess(viewer) || isSuperAdmin(viewer),
      canViewOthers: isFullAccess(viewer) || isSuperAdmin(viewer),
    },
    target: {
      id: target.id,
      name: target.name,
      email: target.email,
      phoneNumber: target.phoneNumber,
      profile: target.profile,
      crmRoles,
      displayName:
        target.profile?.preferredName ||
        target.profile?.fullName ||
        target.name ||
        target.email ||
        'Staff member',
      displayTitle: target.profile?.title ?? null,
      displayPhone: target.profile?.phone ?? target.phoneNumber ?? null,
    },
    activeClaims,
    claimHistory,
    trainingModules,
    isSelf: viewer.id === target.id,
  }
}

export type StaffProfileData = Awaited<ReturnType<typeof loadStaffProfile>>
