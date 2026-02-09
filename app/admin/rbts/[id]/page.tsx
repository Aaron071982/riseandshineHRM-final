import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import RBTProfileView from '@/components/admin/RBTProfileView'

const rbtProfileInclude = {
  user: true,
  interviews: {
    orderBy: { scheduledAt: 'desc' as const },
    include: { interviewNotes: true },
  },
  onboardingTasks: { orderBy: { sortOrder: 'asc' as const } },
  documents: { orderBy: { uploadedAt: 'desc' as const } },
  onboardingCompletions: {
    select: {
      id: true,
      documentId: true,
      status: true,
      completedAt: true,
      acknowledgmentJson: true,
      document: { select: { id: true, title: true, type: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
} as const

type RBTProfileWithRelations = Prisma.RBTProfileGetPayload<{ include: typeof rbtProfileInclude }>

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** Minimal raw query using only columns the list page uses (resilient when full query fails). */
async function loadRbtProfileMinimalRaw(
  id: string
): Promise<RBTProfileWithRelations | null> {
  try {
    const [profileRow] = await prisma.$queryRaw<
      Array<{
        id: string
        firstName: string
        lastName: string
        phoneNumber: string
        email: string | null
        locationCity: string | null
        locationState: string | null
        zipCode: string | null
        status: string
        source: string | null
        updatedAt: Date
        userId: string
        user_role: string
        user_isActive: boolean
      }>
    >`
      SELECT r.id, r."firstName", r."lastName", r."phoneNumber", r.email,
        r."locationCity", r."locationState", r."zipCode", r.status, r.source, r."updatedAt", r."userId",
        u.role as user_role, u."isActive" as user_isActive
      FROM rbt_profiles r
      JOIN users u ON u.id = r."userId"
      WHERE r.id = ${id}
    `
    if (!profileRow) return null
    let interviewsRows: Array<{ id: string; scheduledAt: Date; durationMinutes: number; interviewerName: string; status: string; decision: string; notes: string | null; meetingUrl: string | null }> = []
    let onboardingTasksRows: Array<{ id: string; taskType: string; title: string; description: string | null; isCompleted: boolean; completedAt: Date | null; uploadUrl: string | null; documentDownloadUrl: string | null; sortOrder: number }> = []
    try {
      interviewsRows = await prisma.$queryRaw`
        SELECT id, "scheduledAt", "durationMinutes", "interviewerName", status, decision, notes, "meetingUrl"
        FROM interviews WHERE "rbtProfileId" = ${id} ORDER BY "scheduledAt" DESC
      `
    } catch (e) {
      console.error('Admin rbts [id]: minimal raw interviews failed', e)
    }
    try {
      onboardingTasksRows = await prisma.$queryRaw`
        SELECT id, "taskType", title, description, "isCompleted", "completedAt", "uploadUrl", "documentDownloadUrl", "sortOrder"
        FROM onboarding_tasks WHERE "rbtProfileId" = ${id} ORDER BY "sortOrder" ASC
      `
    } catch (e) {
      console.error('Admin rbts [id]: minimal raw onboarding_tasks failed', e)
    }
    const interviews = (interviewsRows || []).map((i) => ({
      id: i.id,
      rbtProfileId: id,
      scheduledAt: i.scheduledAt,
      durationMinutes: i.durationMinutes,
      interviewerName: i.interviewerName,
      status: i.status,
      decision: i.decision,
      notes: i.notes,
      meetingUrl: i.meetingUrl,
      reminderSentAt: null,
      reminder_15m_sent_at: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      interviewNotes: null,
    }))
    const onboardingTasks = (onboardingTasksRows || []).map((t) => ({
      ...t,
      rbtProfileId: id,
      taskType: t.taskType as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
    return {
      id: profileRow.id,
      userId: profileRow.userId,
      firstName: profileRow.firstName,
      lastName: profileRow.lastName,
      phoneNumber: profileRow.phoneNumber,
      email: profileRow.email,
      locationCity: profileRow.locationCity,
      locationState: profileRow.locationState,
      zipCode: profileRow.zipCode,
      addressLine1: null,
      addressLine2: null,
      preferredServiceArea: null,
      notes: null,
      gender: null,
      ethnicity: null,
      fortyHourCourseCompleted: false,
      status: profileRow.status as any,
      scheduleCompleted: false,
      source: profileRow.source as any,
      submittedAt: null,
      resumeUrl: null,
      resumeFileName: null,
      resumeMimeType: null,
      resumeSize: null,
      availabilityJson: null,
      languagesJson: null,
      experienceYears: null,
      experienceYearsDisplay: null,
      preferredAgeGroupsJson: null,
      authorizedToWork: null,
      canPassBackgroundCheck: null,
      cprFirstAidCertified: null,
      transportation: null,
      preferredHoursRange: null,
      schedulingToken: null,
      createdAt: profileRow.updatedAt,
      updatedAt: profileRow.updatedAt,
      user: {
        id: profileRow.userId,
        role: profileRow.user_role as any,
        isActive: profileRow.user_isActive,
        name: null,
        phoneNumber: null,
        email: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      interviews,
      onboardingTasks,
      documents: [],
      onboardingCompletions: [],
    } as unknown as RBTProfileWithRelations
  } catch (err) {
    console.error('Admin rbts [id]: loadRbtProfileMinimalRaw failed', err)
    return null
  }
}

/** Load RBT profile by id via raw SQL when Prisma fails or returns null but row exists. Returns null on error. Tries full columns first, then minimal (list-page) columns. */
async function loadRbtProfileRaw(
  id: string
): Promise<RBTProfileWithRelations | null> {
  try {
    const [profileRow] = await prisma.$queryRaw<
      Array<{
        id: string
        userId: string
        firstName: string
        lastName: string
        phoneNumber: string
        email: string | null
        locationCity: string | null
        locationState: string | null
        zipCode: string | null
        addressLine1: string | null
        addressLine2: string | null
        preferredServiceArea: string | null
        notes: string | null
        gender: string | null
        ethnicity: string | null
        fortyHourCourseCompleted: boolean
        status: string
        scheduleCompleted: boolean
        source: string | null
        submittedAt: Date | null
        resumeUrl: string | null
        resumeFileName: string | null
        resumeMimeType: string | null
        resumeSize: number | null
        availabilityJson: unknown
        languagesJson: unknown
        createdAt: Date
        updatedAt: Date
        user_role: string
        user_isActive: boolean
      }>
    >`
      SELECT r.id, r."userId", r."firstName", r."lastName", r."phoneNumber", r.email,
        r."locationCity", r."locationState", r."zipCode", r."addressLine1", r."addressLine2",
        r."preferredServiceArea", r.notes, r.gender, r.ethnicity, r."fortyHourCourseCompleted",
        r.status, r."scheduleCompleted", r.source, r."submittedAt", r."resumeUrl", r."resumeFileName",
        r."resumeMimeType", r."resumeSize", r."availabilityJson", r."languagesJson",
        r."createdAt", r."updatedAt", u.role as user_role, u."isActive" as user_isActive
      FROM rbt_profiles r
      JOIN users u ON u.id = r."userId"
      WHERE r.id = ${id}
    `
    if (!profileRow) return null
    let interviewsRows: Array<{ id: string; scheduledAt: Date; durationMinutes: number; interviewerName: string; status: string; decision: string; notes: string | null; meetingUrl: string | null }> = []
    let onboardingTasksRows: Array<{ id: string; taskType: string; title: string; description: string | null; isCompleted: boolean; completedAt: Date | null; uploadUrl: string | null; documentDownloadUrl: string | null; sortOrder: number }> = []
    try {
      interviewsRows = await prisma.$queryRaw`
        SELECT id, "scheduledAt", "durationMinutes", "interviewerName", status, decision, notes, "meetingUrl"
        FROM interviews WHERE "rbtProfileId" = ${id} ORDER BY "scheduledAt" DESC
      `
    } catch (e) {
      console.error('Admin rbts [id]: raw interviews fallback failed', e)
    }
    try {
      onboardingTasksRows = await prisma.$queryRaw`
        SELECT id, "taskType", title, description, "isCompleted", "completedAt", "uploadUrl", "documentDownloadUrl", "sortOrder"
        FROM onboarding_tasks WHERE "rbtProfileId" = ${id} ORDER BY "sortOrder" ASC
      `
    } catch (e) {
      console.error('Admin rbts [id]: raw onboarding_tasks fallback failed', e)
    }
    const interviews = (interviewsRows || []).map((i) => ({
      id: i.id,
      rbtProfileId: id,
      scheduledAt: i.scheduledAt,
      durationMinutes: i.durationMinutes,
      interviewerName: i.interviewerName,
      status: i.status,
      decision: i.decision,
      notes: i.notes,
      meetingUrl: i.meetingUrl,
      reminderSentAt: null,
      reminder_15m_sent_at: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      interviewNotes: null,
    }))
    const onboardingTasks = (onboardingTasksRows || []).map((t) => ({
      ...t,
      rbtProfileId: id,
      taskType: t.taskType as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
    return {
      id: profileRow.id,
      userId: profileRow.userId,
      firstName: profileRow.firstName,
      lastName: profileRow.lastName,
      phoneNumber: profileRow.phoneNumber,
      email: profileRow.email,
      locationCity: profileRow.locationCity,
      locationState: profileRow.locationState,
      zipCode: profileRow.zipCode,
      addressLine1: profileRow.addressLine1,
      addressLine2: profileRow.addressLine2,
      preferredServiceArea: profileRow.preferredServiceArea,
      notes: profileRow.notes,
      gender: profileRow.gender,
      ethnicity: profileRow.ethnicity,
      fortyHourCourseCompleted: profileRow.fortyHourCourseCompleted,
      status: profileRow.status as any,
      scheduleCompleted: profileRow.scheduleCompleted,
      source: profileRow.source as any,
      submittedAt: profileRow.submittedAt,
      resumeUrl: profileRow.resumeUrl,
      resumeFileName: profileRow.resumeFileName,
      resumeMimeType: profileRow.resumeMimeType,
      resumeSize: profileRow.resumeSize,
      availabilityJson: profileRow.availabilityJson,
      languagesJson: profileRow.languagesJson,
      experienceYears: null,
      experienceYearsDisplay: null,
      preferredAgeGroupsJson: null,
      authorizedToWork: null,
      canPassBackgroundCheck: null,
      cprFirstAidCertified: null,
      transportation: null,
      preferredHoursRange: null,
      schedulingToken: null,
      createdAt: profileRow.createdAt,
      updatedAt: profileRow.updatedAt,
      user: {
        id: profileRow.userId,
        role: profileRow.user_role as any,
        isActive: profileRow.user_isActive,
        name: null,
        phoneNumber: null,
        email: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      interviews,
      onboardingTasks,
      documents: [],
      onboardingCompletions: [],
    } as unknown as RBTProfileWithRelations
  } catch (err) {
    console.error('Admin rbts [id]: loadRbtProfileRaw failed', err)
    return loadRbtProfileMinimalRaw(id)
  }
}

function ProfileUnavailable() {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Profile unavailable</h1>
      <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
        We couldn’t load this RBT profile. It may have been removed or there’s a temporary connection issue.
      </p>
      <Link
        href="/admin/rbts"
        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
      >
        ← Back to RBTs & Candidates
      </Link>
    </div>
  )
}

export default async function RBTProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let rbtProfile: RBTProfileWithRelations | null = null
  try {
    rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id },
      include: rbtProfileInclude,
    })
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3b5b3be0-730f-42a8-8e8a-282e15fc296a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin/rbts/[id]','message':'prisma throw',data:{rbtId:id,msg:(error as Error)?.message?.slice(0,80)},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    console.error('Admin rbts [id]: failed to load profile', error)
    rbtProfile = await loadRbtProfileRaw(id)
    if (!rbtProfile) {
      fetch('http://127.0.0.1:7242/ingest/3b5b3be0-730f-42a8-8e8a-282e15fc296a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin/rbts/[id]','message':'ProfileUnavailable after throw',data:{rbtId:id},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
      return <ProfileUnavailable />
    }
  }

  if (!rbtProfile) {
    const exists = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM rbt_profiles WHERE id = ${id} LIMIT 1
    `.catch(() => [])
    if (exists?.length) {
      rbtProfile = await loadRbtProfileRaw(id)
      if (!rbtProfile) {
        fetch('http://127.0.0.1:7242/ingest/3b5b3be0-730f-42a8-8e8a-282e15fc296a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin/rbts/[id]','message':'ProfileUnavailable exists but raw failed',data:{rbtId:id},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
        return <ProfileUnavailable />
      }
    } else {
      notFound()
    }
  }

  return <RBTProfileView rbtProfile={rbtProfile} />
}

