import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Starting onboarding tasks backfill for hired RBTs...')

  // Find all hired RBTs
  const hiredRBTs = await prisma.rBTProfile.findMany({
    where: { status: 'HIRED' },
  })

  console.log(`Found ${hiredRBTs.length} hired RBT(s)`)

  for (const rbt of hiredRBTs) {
    // Check if they already have onboarding tasks
    const existingTasks = await prisma.onboardingTask.findMany({
      where: { rbtProfileId: rbt.id },
    })

    if (existingTasks.length > 0) {
      console.log(`✅ RBT ${rbt.firstName} ${rbt.lastName} (${rbt.email}) already has ${existingTasks.length} tasks - skipping`)
      continue
    }

    console.log(`📝 Creating onboarding tasks for ${rbt.firstName} ${rbt.lastName} (${rbt.email})...`)

    const onboardingTasks = [
      {
        taskType: 'DOWNLOAD_DOC',
        title: 'Download HIPAA Basics PDF',
        description: 'Download and review the HIPAA Basics for Providers document from CMS',
        documentDownloadUrl: 'https://www.cms.gov/files/document/mln909001-hipaa-basics-providers-privacy-security-breach-notification-rules.pdf',
        sortOrder: 1,
      },
      {
        taskType: 'DOWNLOAD_DOC',
        title: 'Review HHS HIPAA Portal',
        description: 'Review the HHS HIPAA for Professionals portal for comprehensive information',
        documentDownloadUrl: 'https://www.hhs.gov/hipaa/for-professionals/index.html',
        sortOrder: 2,
      },
      {
        taskType: 'DOWNLOAD_DOC',
        title: 'Download Confidentiality Agreement Templates',
        description: 'Download and review the HIPAA Confidentiality Agreement templates',
        documentDownloadUrl: 'https://www.sampleforms.com/hipaa-confidentiality-agreement-forms.html',
        sortOrder: 3,
      },
      {
        taskType: 'TRAINING_LINK',
        title: 'Complete HIPAA Training',
        description: 'Review and complete the HIPAA training materials from HHS',
        documentDownloadUrl: 'https://www.hhs.gov/hipaa/for-professionals/training/index.html',
        sortOrder: 4,
      },
      {
        taskType: 'SIGNATURE',
        title: 'Digital Signature Confirmation',
        description: 'Sign to confirm you have read and understood all HIPAA documents and training materials',
        sortOrder: 5,
      },
      {
        taskType: 'PACKAGE_UPLOAD',
        title: 'Upload Onboarding Package',
        description: 'Upload your complete onboarding package. This will be sent to the administrator for review.',
        sortOrder: 6,
      },
    ]

    await Promise.all(
      onboardingTasks.map((task) =>
        prisma.onboardingTask.create({
          data: {
            rbtProfileId: rbt.id,
            taskType: task.taskType as any,
            title: task.title,
            description: task.description,
            documentDownloadUrl: task.documentDownloadUrl || null,
            sortOrder: task.sortOrder,
          },
        })
      )
    )

    console.log(`✅ Created ${onboardingTasks.length} tasks for ${rbt.firstName} ${rbt.lastName}`)
  }

  console.log('✨ Backfill complete!')
}

main()
  .catch((e) => {
    console.error('❌ Error during backfill:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

