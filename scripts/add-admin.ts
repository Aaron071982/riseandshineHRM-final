import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ADMIN_EMAIL = 'alvi@riseandshiny.nyc'
const ADMIN_NAME = 'Alvi'

async function main() {
  console.log(`Adding admin: ${ADMIN_EMAIL}\n`)

  const existing = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  })

  if (existing) {
    console.log(`✅ User ${ADMIN_EMAIL} already exists (role: ${existing.role})`)
    if (existing.role !== 'ADMIN') {
      await prisma.user.update({
        where: { email: ADMIN_EMAIL },
        data: { role: 'ADMIN', isActive: true },
      })
      console.log(`✅ Updated role to ADMIN`)
    }
    return
  }

  const newUser = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      role: 'ADMIN',
      isActive: true,
      profile: {
        create: {
          fullName: ADMIN_NAME,
          timezone: 'America/New_York',
          skills: [],
          languages: [],
        },
      },
    },
    include: { profile: true },
  })

  console.log(`✅ Created admin user: ${newUser.email}`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
