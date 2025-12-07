import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Create Admin Users
  console.log('Creating admin users...')
  
  const admin1 = await prisma.user.upsert({
    where: { email: 'aaronsiam21@gmail.com' },
    update: {},
    create: {
      phoneNumber: '3473090431',
      name: 'Aaron',
      email: 'aaronsiam21@gmail.com',
      role: 'ADMIN',
      isActive: true,
    },
  })

  const admin2 = await prisma.user.upsert({
    where: { phoneNumber: '5551234567' },
    update: {},
    create: {
      phoneNumber: '5551234567',
      name: 'Kazi',
      email: 'kazi@riseandshine.com',
      role: 'ADMIN',
      isActive: true,
    },
  })

  const admin3 = await prisma.user.upsert({
    where: { phoneNumber: '5559876543' },
    update: {},
    create: {
      phoneNumber: '5559876543',
      name: 'Tisha',
      email: 'tisha@riseandshine.com',
      role: 'ADMIN',
      isActive: true,
    },
  })

  console.log('✅ Created admin users:', { admin1: admin1.name, admin2: admin2.name, admin3: admin3.name })

  // Create Sample RBT Candidates
  console.log('Creating sample RBT candidates...')

  const candidate1 = await prisma.user.upsert({
    where: { phoneNumber: '5551112222' },
    update: {},
    create: {
      phoneNumber: '5551112222',
      name: 'John Doe',
      email: 'john.doe@example.com',
      role: 'CANDIDATE',
      isActive: true,
      rbtProfile: {
        create: {
          firstName: 'John',
          lastName: 'Doe',
          phoneNumber: '5551112222',
          email: 'john.doe@example.com',
          locationCity: 'New York',
          locationState: 'NY',
          zipCode: '10001',
          status: 'NEW',
          notes: 'Experienced RBT with 3 years in the field.',
        },
      },
    },
    include: {
      rbtProfile: true,
    },
  })

  const candidate2 = await prisma.user.upsert({
    where: { phoneNumber: '5553334444' },
    update: {},
    create: {
      phoneNumber: '5553334444',
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      role: 'CANDIDATE',
      isActive: true,
      rbtProfile: {
        create: {
          firstName: 'Jane',
          lastName: 'Smith',
          phoneNumber: '5553334444',
          email: 'jane.smith@example.com',
          locationCity: 'Brooklyn',
          locationState: 'NY',
          zipCode: '11201',
          status: 'REACH_OUT',
          notes: 'Great communication skills, interested in part-time work.',
        },
      },
    },
    include: {
      rbtProfile: true,
    },
  })

  const candidate3 = await prisma.user.upsert({
    where: { phoneNumber: '5555556666' },
    update: {},
    create: {
      phoneNumber: '5555556666',
      name: 'Mike Johnson',
      email: 'mike.johnson@example.com',
      role: 'CANDIDATE',
      isActive: true,
      rbtProfile: {
        create: {
          firstName: 'Mike',
          lastName: 'Johnson',
          phoneNumber: '5555556666',
          email: 'mike.johnson@example.com',
          locationCity: 'Queens',
          locationState: 'NY',
          zipCode: '11101',
          status: 'TO_INTERVIEW',
          notes: 'Ready for interview scheduling.',
        },
      },
    },
    include: {
      rbtProfile: true,
    },
  })

  console.log('✅ Created sample candidates')

  // Create a hired RBT with onboarding tasks
  console.log('Creating hired RBT with onboarding tasks...')

  const hiredRBT = await prisma.user.upsert({
    where: { phoneNumber: '5557778888' },
    update: {},
    create: {
      phoneNumber: '5557778888',
      name: 'Sarah Williams',
      email: 'sarah.williams@example.com',
      role: 'RBT',
      isActive: true,
      rbtProfile: {
        create: {
          firstName: 'Sarah',
          lastName: 'Williams',
          phoneNumber: '5557778888',
          email: 'sarah.williams@example.com',
          locationCity: 'Manhattan',
          locationState: 'NY',
          zipCode: '10016',
          status: 'HIRED',
          notes: 'Recently hired, completing onboarding.',
        },
      },
    },
    include: {
      rbtProfile: true,
    },
  })

  if (hiredRBT.rbtProfile) {
    // Create onboarding tasks for hired RBT
    const onboardingTasks = [
      {
        taskType: 'DOWNLOAD_DOC',
        title: 'Download HIPAA Agreement',
        description: 'Download and review the HIPAA Agreement document',
        documentDownloadUrl: '/documents/hipaa-agreement.pdf',
        sortOrder: 1,
      },
      {
        taskType: 'UPLOAD_SIGNED_DOC',
        title: 'Upload Signed HIPAA Agreement',
        description: 'Upload your signed HIPAA Agreement',
        sortOrder: 2,
      },
      {
        taskType: 'DOWNLOAD_DOC',
        title: 'Download Confidentiality Agreement',
        description: 'Download and review the Confidentiality Agreement document',
        documentDownloadUrl: '/documents/confidentiality-agreement.pdf',
        sortOrder: 3,
      },
      {
        taskType: 'UPLOAD_SIGNED_DOC',
        title: 'Upload Signed Confidentiality Agreement',
        description: 'Upload your signed Confidentiality Agreement',
        sortOrder: 4,
      },
      ...Array.from({ length: 8 }, (_, i) => ({
        taskType: 'VIDEO_COURSE' as const,
        title: `HIPAA Training Video ${i + 1}`,
        description: `Complete HIPAA training video ${i + 1} of 8`,
        documentDownloadUrl: `https://example.com/hipaa-training-${i + 1}`,
        sortOrder: 5 + i,
      })),
    ]

    await Promise.all(
      onboardingTasks.map((task) =>
        prisma.onboardingTask.create({
          data: {
            rbtProfileId: hiredRBT.rbtProfile!.id,
            taskType: task.taskType as any,
            title: task.title,
            description: task.description,
            documentDownloadUrl: task.documentDownloadUrl,
            sortOrder: task.sortOrder,
          },
        })
      )
    )

    console.log('✅ Created onboarding tasks for hired RBT')

    // Create sample shifts
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    const nextWeek2 = new Date()
    nextWeek2.setDate(nextWeek2.getDate() + 8)

    await prisma.shift.createMany({
      data: [
        {
          rbtProfileId: hiredRBT.rbtProfile.id,
          clientName: 'Client A',
          startTime: nextWeek,
          endTime: new Date(nextWeek.getTime() + 2 * 60 * 60 * 1000),
          locationAddress: '123 Main St, New York, NY 10001',
          status: 'SCHEDULED',
        },
        {
          rbtProfileId: hiredRBT.rbtProfile.id,
          clientName: 'Client B',
          startTime: nextWeek2,
          endTime: new Date(nextWeek2.getTime() + 3 * 60 * 60 * 1000),
          locationAddress: '456 Oak Ave, New York, NY 10002',
          status: 'SCHEDULED',
        },
      ],
    })

    console.log('✅ Created sample shifts')
  }

  console.log('🎉 Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

