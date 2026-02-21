/**
 * One-off script: check if any time entries (especially from mobile sync) exist in the HRM DB.
 * Run: npx tsx scripts/check-attendance-sync.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const total = await prisma.timeEntry.count()
  const mobile = await prisma.timeEntry.count({ where: { source: 'MOBILE_APP' } })
  const recent = await prisma.timeEntry.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      rbtProfile: { select: { id: true, firstName: true, lastName: true } },
      sessionNote: { select: { id: true, summary: true } },
    },
  })

  console.log('--- HRM time_entries ---')
  console.log('Total time entries:', total)
  console.log('From MOBILE_APP:', mobile)
  console.log('')
  console.log('10 most recent:')
  recent.forEach((e, i) => {
    console.log(
      `${i + 1}. id=${e.id} | rbt=${e.rbtProfile?.firstName} ${e.rbtProfile?.lastName} (${e.rbtProfileId}) | ` +
        `clockIn=${e.clockInTime.toISOString()} | clockOut=${e.clockOutTime?.toISOString() ?? 'null'} | ` +
        `source=${e.source} | createdAt=${e.createdAt.toISOString()} | sessionNote=${e.sessionNote ? 'yes' : 'no'}`
    )
  })

  const sessionNotesCount = await prisma.sessionNote.count()
  console.log('')
  console.log('Total session_notes:', sessionNotesCount)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
