import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Create Admin Users
  console.log('Creating admin users...')
  
  // Admin 1: Aaron
  const admin1 = await prisma.user.upsert({
    where: { email: 'aaronsiam21@gmail.com' },
    update: {
      role: 'ADMIN',
      isActive: true,
      name: 'Aaron',
    },
    create: {
      phoneNumber: '3473090431',
      name: 'Aaron',
      email: 'aaronsiam21@gmail.com',
      role: 'ADMIN',
      isActive: true,
    },
  })

  // Admin 2: Kazi
  const admin2 = await prisma.user.upsert({
    where: { email: 'kazi@siyam.nyc' },
    update: {
      role: 'ADMIN',
      isActive: true,
      name: 'Kazi',
    },
    create: {
      phoneNumber: null,
      name: 'Kazi',
      email: 'kazi@siyam.nyc',
      role: 'ADMIN',
      isActive: true,
    },
  })

  // Admin 3: Tisha
  const admin3 = await prisma.user.upsert({
    where: { email: 'tisha@riseandshine.nyc' },
    update: {
      role: 'ADMIN',
      isActive: true,
      name: 'Tisha',
    },
    create: {
      phoneNumber: null,
      name: 'Tisha',
      email: 'tisha@riseandshine.nyc',
      role: 'ADMIN',
      isActive: true,
    },
  })

  console.log('✅ Created/updated admin users:', {
    admin1: admin1.email,
    admin2: admin2.email,
    admin3: admin3.email,
  })

  console.log('🎉 Seed completed successfully!')
  console.log('📧 Admin emails configured:')
  console.log('   - aaronsiam21@gmail.com')
  console.log('   - kazi@siyam.nyc')
  console.log('   - tisha@riseandshine.nyc')
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
