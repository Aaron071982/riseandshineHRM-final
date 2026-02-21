/**
 * One-time script: set status = HIRED for these four RBT candidates
 * (by first + last name, case-insensitive).
 * Run: npx tsx scripts/mark-hired.ts
 */
import { PrismaClient } from '@prisma/client'

const NAMES = [
  { firstName: 'Mahdia', lastName: 'Chowdhury' },
  { firstName: 'Amna', lastName: 'Aslam' },
  { firstName: 'Taimur', lastName: 'Khan' },
  { firstName: 'Subaita', lastName: 'Chowdhury' },
  { firstName: 'Khan', lastName: 'SIM' },
]

async function main() {
  const prisma = new PrismaClient()
  for (const { firstName, lastName } of NAMES) {
    const updated = await prisma.rBTProfile.updateMany({
      where: {
        firstName: { equals: firstName, mode: 'insensitive' },
        lastName: { equals: lastName, mode: 'insensitive' },
      },
      data: { status: 'HIRED' },
    })
    console.log(`${firstName} ${lastName}: ${updated.count} profile(s) updated to HIRED`)
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
