/**
 * Dev-only demo: clones the most recent completed in-app assessment into a
 * reassessment using the same record builder as "Start reassessment", writes
 * the same audit entry, and verifies the predecessor was not modified.
 *
 * Usage: set -a; source .env.development; set +a; npx tsx scripts/demo-reassessment-clone.ts
 */
import { prisma } from '@/lib/prisma'
import { logClientAccess } from '@/lib/client-services/audit'
import { parseAssessmentRecord } from '@/lib/crm/assessment/serialize'
import { createReassessmentRecord } from '@/lib/crm/assessment/reassessmentRecord'
import { goalTables, reassessmentIssues, sameValue } from '@/lib/crm/assessment/reassessment'

const DEV_PROJECT_REF = 'gqfnqsxwoyrjphgcrzga'

async function main() {
  if (!process.env.DATABASE_URL?.includes(DEV_PROJECT_REF)) {
    throw new Error('Refusing to run: DATABASE_URL is not the dev project.')
  }

  const source = await prisma.clientTreatmentAssessment.findFirst({
    where: { deletedAt: null, source: 'FORM', status: { in: ['COMPLETED', 'SIGNED'] } },
    orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
  })
  if (!source) throw new Error('No completed in-app assessment in dev.')
  const before = structuredClone(source)

  const created = await createReassessmentRecord(source, source.createdByUserId)
  await logClientAccess({
    userId: source.createdByUserId,
    serviceClientId: source.serviceClientId,
    action: `TREATMENT_ASSESSMENT:CREATED:${created.id}:REASSESSMENT_FROM:${source.id}`,
    ip: 'demo-script',
  })

  const after = await prisma.clientTreatmentAssessment.findUniqueOrThrow({ where: { id: source.id } })
  const clone = await prisma.clientTreatmentAssessment.findUniqueOrThrow({ where: { id: created.id } })

  const prevSections = parseAssessmentRecord(after)
  const cloneSections = parseAssessmentRecord(clone)

  console.log('Predecessor', source.id, `(${source.assessmentType}, ${source.status})`)
  console.log('  unchanged after clone:', sameValue(before, after))
  console.log('Reassessment', clone.id)
  console.log('  type/status:', clone.assessmentType, clone.status, '· previousAssessmentId:', clone.previousAssessmentId)
  console.log('  reportDate:', clone.reportDate, '· summary.reportDate:', JSON.stringify(cloneSections.summary.reportDate))
  console.log('  BCBA signature cleared:', !cloneSections.signatures.bcba.signatureData && !cloneSections.signatures.bcba.date)

  for (const table of goalTables(cloneSections)) {
    const prevTable = goalTables(prevSections).find((t) => t.key === table.key)!
    for (const row of table.rows.slice(0, 1)) {
      const prevRow = prevTable.rows.find((r) => r.id === row.id)
      const prevKey = table.variant === 'A' ? 'previousAssessmentScore' : 'previousAssessmentPerformance'
      console.log(
        `  goal [${table.label}]`,
        `predecessor current=${JSON.stringify(prevRow?.currentPerformance)}`,
        `→ clone previous=${JSON.stringify((row as Record<string, unknown>)[prevKey])}`,
        `current=${JSON.stringify(row.currentPerformance)} status=${JSON.stringify(row.status)}`
      )
    }
  }

  const r = cloneSections.reassessment
  console.log('  reporting period start (prefilled):', r.reportingPeriod.periodStart || '(none)')
  console.log('  caregiver training minimum:', r.caregiverTraining.requiredMinimum)
  console.log('  instruments:', r.instrumentComparison.map((i) => `${i.instrument}${i.priorDate ? ` prior ${i.priorDate}` : ''}`).join(', '))
  console.log('  units (previous request):', r.unitsRequested.map((u) => `${u.code}=${u.previousRequest || '—'}`).join(', '))
  console.log('  open checklist items:')
  for (const issue of reassessmentIssues(cloneSections)) console.log('   -', issue.message)
  console.log(`  open in app: /client-services/clients/${clone.serviceClientId}/assessments/${clone.id}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
