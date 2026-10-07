import 'server-only'

import { prisma } from '@/lib/prisma'
import { I9_SECTION2_DEADLINE_BUSINESS_DAYS } from '@/lib/onboarding/catalog'
import { I9_DOCUMENT_TYPE } from '@/lib/rbtDocumentsSync'
import { businessDaysBetween, calendarDaysBetween } from '@/lib/compliance/businessDays'

/** Pre-catalog onboarding document (no step number) that some staff completed in early 2026. */
const LEGACY_I9_SLUG = 'i9'

export type HireDateSource = 'RECORDED' | 'AUDIT_LOG' | 'ONBOARDING_START' | 'UNKNOWN'

export type I9Status = 'COMPLETE' | 'SECTION_2_PENDING' | 'NOT_STARTED'

export type I9ReportRow = {
  rbtProfileId: string
  name: string
  email: string | null
  postHireStage: string | null
  hireDate: Date | null
  hireDateSource: HireDateSource
  calendarDaysSinceHire: number | null
  businessDaysSinceHire: number | null
  status: I9Status
  section1CompletedAt: Date | null
  section2CompletedAt: Date | null
  i9DocumentsOnFile: number
  legacyI9CompletionId: string | null
  /** Section 2 unset and hire date more than 3 business days ago. */
  section2Overdue: boolean
  /** Delivering services without Section 1 on file. */
  workingWithoutSection1: boolean
}

export async function loadI9ComplianceReport(now = new Date()): Promise<I9ReportRow[]> {
  const staff = await prisma.rBTProfile.findMany({
    where: { status: { in: ['HIRED', 'ONBOARDING_COMPLETED'] } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      postHireStage: true,
      hiredAt: true,
      i9Section1CompletedAt: true,
      i9Section2CompletedAt: true,
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })
  const ids = staff.map((s) => s.id)
  if (ids.length === 0) return []

  const [hireLogs, firstCompletions, i9Docs, legacyDoc] = await Promise.all([
    prisma.rBTAuditLog.groupBy({
      by: ['rbtProfileId'],
      where: {
        rbtProfileId: { in: ids },
        auditType: 'STATUS_CHANGE',
        notes: { contains: 'to HIRED' },
      },
      _min: { dateTime: true },
    }),
    prisma.onboardingCompletion.groupBy({
      by: ['rbtProfileId'],
      where: { rbtProfileId: { in: ids } },
      _min: { createdAt: true },
    }),
    prisma.rBTDocument.groupBy({
      by: ['rbtProfileId'],
      where: { rbtProfileId: { in: ids }, documentType: I9_DOCUMENT_TYPE },
      _count: { _all: true },
    }),
    prisma.onboardingDocument.findUnique({ where: { slug: LEGACY_I9_SLUG }, select: { id: true } }),
  ])

  const legacyCompletions = legacyDoc
    ? await prisma.onboardingCompletion.findMany({
        where: { rbtProfileId: { in: ids }, documentId: legacyDoc.id, status: 'COMPLETED' },
        select: { id: true, rbtProfileId: true },
      })
    : []

  const hireLogBy = new Map(hireLogs.map((r) => [r.rbtProfileId, r._min.dateTime]))
  const firstCompletionBy = new Map(firstCompletions.map((r) => [r.rbtProfileId, r._min.createdAt]))
  const i9DocsBy = new Map(i9Docs.map((r) => [r.rbtProfileId, r._count._all]))
  const legacyBy = new Map(legacyCompletions.map((c) => [c.rbtProfileId, c.id]))

  return staff.map((s) => {
    let hireDate: Date | null = null
    let hireDateSource: HireDateSource = 'UNKNOWN'
    if (s.hiredAt) {
      hireDate = s.hiredAt
      hireDateSource = 'RECORDED'
    } else if (hireLogBy.get(s.id)) {
      hireDate = hireLogBy.get(s.id)!
      hireDateSource = 'AUDIT_LOG'
    } else if (firstCompletionBy.get(s.id)) {
      hireDate = firstCompletionBy.get(s.id)!
      hireDateSource = 'ONBOARDING_START'
    }

    const businessDaysSinceHire = hireDate ? businessDaysBetween(hireDate, now) : null
    const status: I9Status =
      s.i9Section1CompletedAt && s.i9Section2CompletedAt
        ? 'COMPLETE'
        : s.i9Section1CompletedAt
          ? 'SECTION_2_PENDING'
          : 'NOT_STARTED'

    return {
      rbtProfileId: s.id,
      name: `${s.firstName} ${s.lastName}`.replace(/\s+/g, ' ').trim(),
      email: s.email,
      postHireStage: s.postHireStage,
      hireDate,
      hireDateSource,
      calendarDaysSinceHire: hireDate ? calendarDaysBetween(hireDate, now) : null,
      businessDaysSinceHire,
      status,
      section1CompletedAt: s.i9Section1CompletedAt,
      section2CompletedAt: s.i9Section2CompletedAt,
      i9DocumentsOnFile: i9DocsBy.get(s.id) ?? 0,
      legacyI9CompletionId: legacyBy.get(s.id) ?? null,
      section2Overdue:
        !s.i9Section2CompletedAt &&
        (businessDaysSinceHire == null ||
          businessDaysSinceHire > I9_SECTION2_DEADLINE_BUSINESS_DAYS),
      workingWithoutSection1: !s.i9Section1CompletedAt && s.postHireStage === 'ACTIVE_DELIVERY',
    }
  })
}
