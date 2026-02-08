import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { notFound } from 'next/navigation'
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
    console.error('Admin rbts [id]: failed to load profile', error)
    // Fallback: load profile by id via raw SQL so profile page doesn't 404 when Prisma fails
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
      if (!profileRow) {
        notFound()
      }
      // Load interviews and tasks in separate try/catch so one failing (e.g. missing column) doesn't 404 the profile
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
      rbtProfile = {
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
    } catch (rawErr) {
      console.error('Admin rbts [id]: raw fallback failed', rawErr)
      notFound()
    }
  }

  if (!rbtProfile) {
    notFound()
  }

  return <RBTProfileView rbtProfile={rbtProfile} />
}

