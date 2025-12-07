import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Adding onboarding folder download task to all hired RBTs...\n')

  const hiredRBTs = await prisma.rBTProfile.findMany({
    where: { status: 'HIRED' },
    include: {
      onboardingTasks: {
        where: { taskType: 'DOWNLOAD_DOC' },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  for (const rbt of hiredRBTs) {
    console.log(`Processing: ${rbt.firstName} ${rbt.lastName}`)
    
    // Check if folder download task already exists
    const hasFolderTask = rbt.onboardingTasks.some(
      (task) => task.title.toLowerCase().includes('folder') || 
                task.documentDownloadUrl === '/api/rbt/onboarding-package/download'
    )

    if (hasFolderTask) {
      console.log(`  ✓ Already has folder download task`)
      continue
    }

    // Find the highest sortOrder for DOWNLOAD_DOC tasks
    const maxSortOrder = rbt.onboardingTasks.length > 0
      ? Math.max(...rbt.onboardingTasks.map(t => t.sortOrder))
      : 0

    // Create the folder download task with sortOrder 4 (after the 3 existing download tasks)
    await prisma.onboardingTask.create({
      data: {
        rbtProfileId: rbt.id,
        taskType: 'DOWNLOAD_DOC',
        title: 'Download Onboarding Documents Folder',
        description: 'Download the complete onboarding documents folder. You will need to fill out all documents and re-upload them as a folder after logging in.',
        documentDownloadUrl: '/api/rbt/onboarding-package/download',
        sortOrder: 4,
        isCompleted: false,
      },
    })

    console.log(`  ✅ Added folder download task`)
  }

  console.log('\n✅ Done! All hired RBTs now have the onboarding folder download task.')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

