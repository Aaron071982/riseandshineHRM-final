/**
 * DESTRUCTIVE: wipes RBT/candidate users and related HR data.
 * Usage: npx tsx scripts/clear-rbts.ts [--confirm] [--prod-confirm]
 */
import { PrismaClient } from '@prisma/client'
import { assertWriteTarget } from '../lib/scripts/guard'

const prisma = new PrismaClient()

async function main() {
  const target = assertWriteTarget({ allowProd: true })
  console.log('🧹 Starting RBT data cleanup...')

  if (target.dryRun) {
    const counts = await Promise.all([
      prisma.interviewEmailLog.count(),
      prisma.onboardingTask.count(),
      prisma.timeEntry.count(),
      prisma.shift.count(),
      prisma.leaveRequest.count(),
      prisma.interview.count(),
      prisma.rBTProfile.count(),
      prisma.user.count({ where: { role: { in: ['RBT', 'CANDIDATE'] } } }),
    ])
    console.log('Would delete (dry run):', {
      interviewEmailLogs: counts[0],
      onboardingTasks: counts[1],
      timeEntries: counts[2],
      shifts: counts[3],
      leaveRequests: counts[4],
      interviews: counts[5],
      rbtProfiles: counts[6],
      rbtCandidateUsers: counts[7],
    })
    return
  }

  try {
    const emailLogsDeleted = await prisma.interviewEmailLog.deleteMany({})
    console.log(`✅ Deleted ${emailLogsDeleted.count} email logs`)

    const tasksDeleted = await prisma.onboardingTask.deleteMany({})
    console.log(`✅ Deleted ${tasksDeleted.count} onboarding tasks`)

    const timeEntriesDeleted = await prisma.timeEntry.deleteMany({})
    console.log(`✅ Deleted ${timeEntriesDeleted.count} time entries`)

    const shiftsDeleted = await prisma.shift.deleteMany({})
    console.log(`✅ Deleted ${shiftsDeleted.count} shifts`)

    const leaveRequestsDeleted = await prisma.leaveRequest.deleteMany({})
    console.log(`✅ Deleted ${leaveRequestsDeleted.count} leave requests`)

    const interviewsDeleted = await prisma.interview.deleteMany({})
    console.log(`✅ Deleted ${interviewsDeleted.count} interviews`)

    const rbtAndCandidateUsers = await prisma.user.findMany({
      where: { role: { in: ['RBT', 'CANDIDATE'] } },
      include: { sessions: true },
    })

    console.log(`📋 Found ${rbtAndCandidateUsers.length} RBT/Candidate users to delete`)

    for (const user of rbtAndCandidateUsers) {
      if (user.sessions.length > 0) {
        await prisma.session.deleteMany({ where: { userId: user.id } })
      }
    }

    const rbtProfilesDeleted = await prisma.rBTProfile.deleteMany({})
    console.log(`✅ Deleted ${rbtProfilesDeleted.count} RBT profiles`)

    const usersDeleted = await prisma.user.deleteMany({
      where: { role: { in: ['RBT', 'CANDIDATE'] } },
    })
    console.log(`✅ Deleted ${usersDeleted.count} RBT/Candidate users`)

    const otpCodesDeleted = await prisma.otpCode.deleteMany({})
    console.log(`✅ Deleted ${otpCodesDeleted.count} OTP codes`)

    const adminUsers = await prisma.user.findMany({ where: { role: 'ADMIN' } })
    console.log(`✅ Preserved ${adminUsers.length} admin users`)

    console.log('🎉 RBT data cleanup completed successfully!')
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})
