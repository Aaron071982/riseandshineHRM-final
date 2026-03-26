import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Removing old TRAINING_LINK tasks from all hired RBTs...\n')

  // Delete all TRAINING_LINK tasks
  const result = await prisma.onboardingTask.deleteMany({
    where: {
      taskType: 'TRAINING_LINK',
    },
  })

  console.log(`✅ Deleted ${result.count} old TRAINING_LINK task(s)\n`)

  // Also check for any tasks with duplicate sortOrder
  const hiredRBTs = await prisma.rBTProfile.findMany({
    where: { status: 'HIRED' },
    include: {
      onboardingTasks: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  console.log('Verifying task counts for all hired RBTs:\n')
  
  for (const rbt of hiredRBTs) {
    const downloadTasks = rbt.onboardingTasks.filter(t => t.taskType === 'DOWNLOAD_DOC')
    const signatureTasks = rbt.onboardingTasks.filter(t => t.taskType === 'SIGNATURE')
    const uploadTasks = rbt.onboardingTasks.filter(t => t.taskType === 'PACKAGE_UPLOAD')
    const trainingTasks = rbt.onboardingTasks.filter(t => t.taskType === 'TRAINING_LINK')
    
    const total = rbt.onboardingTasks.length
    const completed = rbt.onboardingTasks.filter(t => t.isCompleted).length
    
    console.log(`${rbt.firstName} ${rbt.lastName}:`)
    console.log(`  Total: ${total} tasks (Expected: 6)`)
    console.log(`  Download: ${downloadTasks.length} (Expected: 4)`)
    console.log(`  Signature: ${signatureTasks.length} (Expected: 1)`)
    console.log(`  Upload: ${uploadTasks.length} (Expected: 1)`)
    console.log(`  Training: ${trainingTasks.length} (Expected: 0)`)
    console.log(`  Completed: ${completed}/${total}`)
    console.log('')
  }

  console.log('✅ Done!')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

