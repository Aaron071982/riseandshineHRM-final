/**
 * Seed demo assessments + 1099 pay stubs for local BCBA portal testing.
 * Uses the real HTML→PDF stub renderer (same as production) — never a placeholder PDF.
 *
 *   dotenv -e .env.development -- tsx scripts/seed-bcba-portal-demo.ts
 */
import { createClient } from '@supabase/supabase-js'
import { PrismaClient, type Prisma } from '@prisma/client'
import { sectionsWithClientPrefill } from '../lib/crm/assessment/prefill'
import { defaultAssessmentSections } from '../lib/crm/assessment/assessment.schema'
import { renderPayStubPdf } from '../lib/payroll/renderPayStubPdf'

const EMAIL = 'bcba@riseandshineaba.com'
const BUCKET = 'payroll-statements'
const PREFIX = 'payroll-statements'
const prisma = new PrismaClient()

function storageAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env missing for stub upload')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function uploadStubPdf(storagePath: string, bytes: Buffer) {
  const { error } = await storageAdmin()
    .storage.from(BUCKET)
    .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: true })
  if (error) throw error
}

function sectionJson(
  sections: ReturnType<typeof defaultAssessmentSections>
): Pick<
  Prisma.ClientTreatmentAssessmentUncheckedCreateInput,
  | 'summary'
  | 'treatmentRequest'
  | 'locationSchedule'
  | 'bioPsychosocial'
  | 'instruments'
  | 'presentLevels'
  | 'environmental'
  | 'responseToTx'
  | 'interventions'
  | 'behaviors'
  | 'goals'
  | 'parentTraining'
  | 'servicesProtocols'
  | 'transitionPlan'
  | 'coordination'
  | 'recommendations'
  | 'crisisPlan'
  | 'signatures'
> {
  return {
    summary: sections.summary,
    treatmentRequest: sections.treatmentRequest,
    locationSchedule: sections.locationSchedule,
    bioPsychosocial: sections.bioPsychosocial,
    instruments: sections.instruments,
    presentLevels: sections.presentLevels,
    environmental: sections.environmental,
    responseToTx: sections.responseToTx,
    interventions: sections.interventions,
    behaviors: sections.behaviors,
    goals: sections.goals,
    parentTraining: sections.parentTraining,
    servicesProtocols: sections.servicesProtocols,
    transitionPlan: sections.transitionPlan,
    coordination: sections.coordination,
    recommendations: sections.recommendations,
    crisisPlan: sections.crisisPlan,
    signatures: sections.signatures,
  }
}

async function ensureContractor(userId: string, name: string) {
  let contractor = await prisma.contractorProfile.findUnique({
    where: { userId },
  })
  if (!contractor) {
    const rate = await prisma.payRate.create({
      data: {
        ratePerHour: 105,
        effectiveFrom: new Date('2026-01-01'),
      },
    })
    contractor = await prisma.contractorProfile.create({
      data: {
        userId,
        legalName: name,
        entityName: 'Test BCBA PLLC',
        classification: '1099',
        activeRateId: rate.id,
      },
    })
    await prisma.payRate.update({
      where: { id: rate.id },
      data: { contractorId: contractor.id },
    })
  } else if (!contractor.activeRateId) {
    const rate = await prisma.payRate.create({
      data: {
        contractorId: contractor.id,
        ratePerHour: 105,
        effectiveFrom: new Date('2026-01-01'),
      },
    })
    contractor = await prisma.contractorProfile.update({
      where: { id: contractor.id },
      data: { activeRateId: rate.id },
    })
  }
  return contractor
}

async function ensurePeriod(label: string, start: string, end: string, pay: string) {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const payDate = new Date(pay)
  const existing = await prisma.payPeriod.findFirst({
    where: { label, startDate, endDate },
  })
  if (existing) return existing
  return prisma.payPeriod.create({
    data: { label, startDate, endDate, payDate },
  })
}

async function seedStub(input: {
  contractorId: string
  actorUserId: string
  period: { id: string; startDate: Date; endDate: Date; payDate: Date; label: string }
  hours: number
  rate: number
  lines: Array<{ workDate: string; start: string; end: string; hours: number }>
}) {
  const gross = Math.round(input.hours * input.rate * 100) / 100
  // 1099 — no tax deductions
  const deductions = 0
  const netPay = gross

  const existing = await prisma.payStatement.findFirst({
    where: {
      contractorId: input.contractorId,
      payPeriodId: input.period.id,
      payeeType: 'BCBA',
    },
  })
  if (existing) {
    console.log(`  stub exists for ${input.period.label}: ${existing.id}`)
    return existing
  }

  const statement = await prisma.payStatement.create({
    data: {
      payPeriodId: input.period.id,
      payeeType: 'BCBA',
      contractorId: input.contractorId,
      status: 'DRAFT',
      totalHours: input.hours,
      grossPay: gross,
      deductions,
      netPay,
      reconciled: true,
      lineItems: {
        create: input.lines.map((l) => ({
          workDate: new Date(l.workDate),
          startClock: l.start,
          endClock: l.end,
          hours: l.hours,
          amount: Math.round(l.hours * input.rate * 100) / 100,
          source: 'MANUAL',
        })),
      },
    },
  })

  const path = `${PREFIX}/bcba/${input.contractorId}/${statement.id}.pdf`
  const pdfBytes = await renderPayStubPdf({
    payeeType: 'BCBA',
    legalName: 'Test BCBA',
    entityName: 'Test BCBA PLLC',
    payDate: input.period.payDate,
    periodStart: input.period.startDate,
    periodEnd: input.period.endDate,
    ratePerHour: input.rate,
    deductions: 0,
    deductionRows: [],
    reconciled: true,
    ytd: null,
    lineItems: input.lines.map((l) => ({
      workDate: new Date(l.workDate),
      startClock: l.start,
      endClock: l.end,
      hours: l.hours,
      amount: Math.round(l.hours * input.rate * 100) / 100,
    })),
  })
  await uploadStubPdf(path, pdfBytes)

  await prisma.payStatement.update({
    where: { id: statement.id },
    data: {
      pdfUrl: path,
      status: 'SENT',
      sentAt: new Date(),
      // Explicit: 1099 contractors have no employee tax withholdings
      deductions: 0,
      netPay: gross,
    },
  })

  console.log(`  seeded stub ${statement.id} (${input.period.label}) net=$${netPay}`)
  return statement
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: {
      id: true,
      name: true,
      email: true,
      bcbaProfile: { select: { id: true } },
    },
  })
  if (!user) throw new Error(`User ${EMAIL} not found — create login first`)

  const clients = await prisma.serviceClient.findMany({
    where: { assignedBcbaId: user.id, deletedAt: null },
    take: 5,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      clientCode: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      parentName: true,
      diagnosis: true,
      referringProvider: true,
    },
  })
  if (clients.length === 0) {
    throw new Error('No clients assigned to this BCBA')
  }

  const statuses = [
    'DRAFT',
    'IN_PROGRESS',
    'COMPLETED',
    'SIGNED',
  ] as const

  console.log(`Seeding assessments for ${clients.length} clients…`)
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i]
    const status = statuses[i % statuses.length]
    const existing = await prisma.clientTreatmentAssessment.findFirst({
      where: { serviceClientId: client.id, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    })
    if (existing) {
      await prisma.clientTreatmentAssessment.update({
        where: { id: existing.id },
        data: {
          status,
          completedAt:
            status === 'COMPLETED' || status === 'SIGNED' ? new Date() : null,
          signedAt: status === 'SIGNED' ? new Date() : null,
          updatedByUserId: user.id,
          summary: {
            ...(typeof existing.summary === 'object' && existing.summary
              ? (existing.summary as object)
              : {}),
            assessorName: user.name ?? 'Test BCBA',
          } as Prisma.InputJsonValue,
        },
      })
      console.log(`  updated ${client.clientCode} → ${status} (${existing.id})`)
      continue
    }

    const sections = sectionsWithClientPrefill(client)
    sections.summary.assessorName = user.name ?? 'Test BCBA'
    const created = await prisma.clientTreatmentAssessment.create({
      data: {
        serviceClientId: client.id,
        status,
        source: 'FORM',
        createdByUserId: user.id,
        updatedByUserId: user.id,
        completedAt:
          status === 'COMPLETED' || status === 'SIGNED' ? new Date() : null,
        signedAt: status === 'SIGNED' ? new Date() : null,
        ...sectionJson(sections),
      },
    })
    console.log(`  created ${client.clientCode} → ${status} (${created.id})`)
  }

  console.log('Seeding 1099 contractor + pay stubs (no tax)…')
  const contractor = await ensureContractor(
    user.id,
    user.name?.trim() || 'Test BCBA'
  )
  const p1 = await ensurePeriod(
    'Mar 2–15, 2026',
    '2026-03-02',
    '2026-03-15',
    '2026-03-20'
  )
  const p2 = await ensurePeriod(
    'Mar 16–29, 2026',
    '2026-03-16',
    '2026-03-29',
    '2026-04-03'
  )

  await seedStub({
    contractorId: contractor.id,
    actorUserId: user.id,
    period: p1,
    hours: 12,
    rate: 105,
    lines: [
      { workDate: '2026-03-03', start: '9.00', end: '12.00', hours: 3 },
      { workDate: '2026-03-05', start: '13.00', end: '17.00', hours: 4 },
      { workDate: '2026-03-10', start: '10.00', end: '15.00', hours: 5 },
    ],
  })
  await seedStub({
    contractorId: contractor.id,
    actorUserId: user.id,
    period: p2,
    hours: 10,
    rate: 105,
    lines: [
      { workDate: '2026-03-17', start: '9.00', end: '13.00', hours: 4 },
      { workDate: '2026-03-20', start: '14.00', end: '17.00', hours: 3 },
      { workDate: '2026-03-24', start: '10.00', end: '13.00', hours: 3 },
    ],
  })

  console.log('Done. Login as', EMAIL, '→ /portal/assessments and /portal/pay')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
