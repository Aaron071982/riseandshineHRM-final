/**
 * One-shot: normalize crm_training_steps.stepNumber to contiguous 1..n per module.
 * Safe to re-run. Fixes interrupted renumbers / ensure collisions aftermath.
 *
 * Usage: npx tsx scripts/repair-crm-training-steps.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function renumber(moduleId: string, orderedStepIds: string[]) {
  for (let i = 0; i < orderedStepIds.length; i++) {
    await prisma.crmTrainingStep.update({
      where: { id: orderedStepIds[i] },
      data: { stepNumber: -(i + 1) },
    })
  }
  for (let i = 0; i < orderedStepIds.length; i++) {
    await prisma.crmTrainingStep.update({
      where: { id: orderedStepIds[i] },
      data: { stepNumber: i + 1 },
    })
  }
}

async function main() {
  const modules = await prisma.crmTrainingModule.findMany({
    select: {
      id: true,
      crmRole: true,
      title: true,
      steps: {
        orderBy: [{ stepNumber: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, stepNumber: true, slug: true, title: true },
      },
    },
  })

  console.log(`Found ${modules.length} training modules`)

  for (const mod of modules) {
    const nums = mod.steps.map((s) => s.stepNumber)
    const contiguous = mod.steps.every((s, i) => s.stepNumber === i + 1)
    const hasNeg = nums.some((n) => n < 0)
    const dupes = nums.length !== new Set(nums).size

    console.log(
      `\n${mod.crmRole} (${mod.title}): ${mod.steps.length} steps`,
      contiguous ? 'OK' : `NEEDS REPAIR nums=[${nums.join(',')}]`,
      hasNeg ? 'HAS_NEGATIVES' : '',
      dupes ? 'HAS_DUPES' : ''
    )

    if (contiguous) continue

    await prisma.$transaction(async () => {
      await renumber(
        mod.id,
        mod.steps.map((s) => s.id)
      )
    })
    console.log(`  → renumbered to 1..${mod.steps.length}`)
  }

  console.log('\nDone.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
