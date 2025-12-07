import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Starting RBT data cleanup...')

  try {
    // Delete all RBT-related data in the correct order to respect foreign key constraints
    
    // 1. Delete email logs (references RBTProfile)
    const emailLogsDeleted = await prisma.interviewEmailLog.deleteMany({})
    console.log(`✅ Deleted ${emailLogsDeleted.count} email logs`)

    // 2. Delete onboarding tasks (references RBTProfile)
    const tasksDeleted = await prisma.onboardingTask.deleteMany({})
    console.log(`✅ Deleted ${tasksDeleted.count} onboarding tasks`)

    // 3. Delete time entries (references RBTProfile and Shift)
    const timeEntriesDeleted = await prisma.timeEntry.deleteMany({})
    console.log(`✅ Deleted ${timeEntriesDeleted.count} time entries`)

    // 4. Delete shifts (references RBTProfile)
    const shiftsDeleted = await prisma.shift.deleteMany({})
    console.log(`✅ Deleted ${shiftsDeleted.count} shifts`)

    // 5. Delete leave requests (references RBTProfile)
    const leaveRequestsDeleted = await prisma.leaveRequest.deleteMany({})
    console.log(`✅ Deleted ${leaveRequestsDeleted.count} leave requests`)

    // 6. Delete interviews (references RBTProfile)
    const interviewsDeleted = await prisma.interview.deleteMany({})
    console.log(`✅ Deleted ${interviewsDeleted.count} interviews`)

    // 7. Get all RBT and CANDIDATE users (preserve ADMIN users)
    const rbtAndCandidateUsers = await prisma.user.findMany({
      where: {
        role: {
          in: ['RBT', 'CANDIDATE'],
        },
      },
      include: {
        rbtProfile: true,
        sessions: true,
      },
    })

    console.log(`📋 Found ${rbtAndCandidateUsers.length} RBT/Candidate users to delete`)

    // 8. Delete sessions for these users (will cascade, but being explicit)
    for (const user of rbtAndCandidateUsers) {
      if (user.sessions.length > 0) {
        await prisma.session.deleteMany({
          where: { userId: user.id },
        })
      }
    }

    // 9. Delete RBT profiles (this will cascade to related data, but we've already deleted most)
    const rbtProfilesDeleted = await prisma.rBTProfile.deleteMany({})
    console.log(`✅ Deleted ${rbtProfilesDeleted.count} RBT profiles`)

    // 10. Delete RBT and CANDIDATE users (preserve ADMIN users)
    const usersDeleted = await prisma.user.deleteMany({
      where: {
        role: {
          in: ['RBT', 'CANDIDATE'],
        },
      },
    })
    console.log(`✅ Deleted ${usersDeleted.count} RBT/Candidate users`)

    // 11. Clean up orphaned OTP codes (optional, but good for cleanup)
    const otpCodesDeleted = await prisma.otpCode.deleteMany({})
    console.log(`✅ Deleted ${otpCodesDeleted.count} OTP codes`)

    // 12. Verify ADMIN users are still present
    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN' },
    })
    console.log(`✅ Preserved ${adminUsers.length} admin users`)

    console.log('🎉 RBT data cleanup completed successfully!')
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })

