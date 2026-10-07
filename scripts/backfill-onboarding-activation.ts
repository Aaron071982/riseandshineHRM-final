/**
 * Re-evaluates onboarding milestones for hired RBTs (e.g. after optional steps change)
 * and stamps tierA/tierB/fullyActivatedAt where now satisfied.
 *
 * Usage: npx tsx scripts/backfill-onboarding-activation.ts [--apply]
 */
import { prisma } from '@/lib/prisma'
import { getOnboardingProgress, syncTierMilestones } from '@/lib/onboarding/progress'

async function main() {
  const apply = process.argv.includes('--apply')
  const rbts = await prisma.rBTProfile.findMany({
    where: { status: { in: ['HIRED', 'ONBOARDING_COMPLETED'] }, fullyActivatedAt: null },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: { lastName: 'asc' },
  })

  let newlyComplete = 0
  const waitingOnAdmin: string[] = []
  for (const rbt of rbts) {
    const progress = await getOnboardingProgress(rbt.id)
    if (!progress.fullyActivated) {
      if (progress.tierAComplete && progress.tierBComplete) {
        const missing = [
          !progress.profile.backgroundCheckClearedAt && 'background check cleared',
          !progress.profile.supervisionCountersignedAt && 'supervision countersigned',
        ].filter(Boolean)
        waitingOnAdmin.push(`${rbt.firstName} ${rbt.lastName} — needs ${missing.join(' + ')}`)
      }
      continue
    }
    newlyComplete++
    console.log(`${apply ? 'ACTIVATING' : 'would activate'}: ${rbt.firstName} ${rbt.lastName} <${rbt.email ?? '—'}>`)
    if (apply) await syncTierMilestones(rbt.id)
  }

  if (waitingOnAdmin.length > 0) {
    console.log(`\nRBT-side steps done, waiting on admin (${waitingOnAdmin.length}):`)
    for (const line of waitingOnAdmin) console.log(`  ${line}`)
  }

  console.log(
    `\n${rbts.length} hired RBTs without activation; ${newlyComplete} now meet the onboarding rule${apply ? ' (stamped)' : ' (dry run)'}.`
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
