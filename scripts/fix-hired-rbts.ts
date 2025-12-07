import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Fixing all hired RBTs...\n')

  const hiredRBTs = await prisma.rBTProfile.findMany({
    where: { status: 'HIRED' },
    include: { user: true, onboardingTasks: true },
  })

  for (const rbt of hiredRBTs) {
    console.log(`\n${rbt.firstName} ${rbt.lastName} (${rbt.email}):`)

    // Fix user record
    if (rbt.user) {
      const needsUpdate =
        rbt.user.role !== 'RBT' || !rbt.user.isActive || rbt.user.email !== rbt.email

      if (needsUpdate) {
        await prisma.user.update({
          where: { id: rbt.userId },
          data: {
            role: 'RBT',
            email: rbt.email || undefined,
            isActive: true,
          },
        })
        console.log(`  ✅ Fixed user record`)
      } else {
        console.log(`  ✅ User record is correct`)
      }
    } else {
      console.log(`  ⚠️  No user record found!`)
    }

    // Ensure onboarding tasks exist
    if (rbt.onboardingTasks.length !== 6) {
      console.log(`  ⚠️  Found ${rbt.onboardingTasks.length} tasks, need 6`)

      // Delete existing tasks
      await prisma.onboardingTask.deleteMany({
        where: { rbtProfileId: rbt.id },
      })

      // Create all 6 tasks
      const tasks = [
        {
          taskType: 'DOWNLOAD_DOC',
          title: 'Download HIPAA Basics PDF',
          description: 'Download and review the HIPAA Basics for Providers document from CMS',
          documentDownloadUrl:
            'https://www.cms.gov/files/document/mln909001-hipaa-basics-providers-privacy-security-breach-notification-rules.pdf',
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
          documentDownloadUrl:
            'https://www.sampleforms.com/hipaa-confidentiality-agreement-forms.html',
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
          description:
            'Sign to confirm you have read and understood all HIPAA documents and training materials',
          sortOrder: 5,
        },
        {
          taskType: 'PACKAGE_UPLOAD',
          title: 'Upload Onboarding Package',
          description:
            'Upload your complete onboarding package. This will be sent to the administrator for review.',
          sortOrder: 6,
        },
      ]

      await Promise.all(
        tasks.map((task) =>
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

      console.log(`  ✅ Created 6 onboarding tasks`)
    } else {
      console.log(`  ✅ Has all 6 onboarding tasks`)
    }
  }

  console.log(`\n✅ All hired RBTs are now properly configured!`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

