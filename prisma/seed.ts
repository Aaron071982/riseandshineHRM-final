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

  // Admin 4: Fardeen
  const admin4 = await prisma.user.upsert({
    where: { email: 'fardeen@riseandshine.nyc' },
    update: {
      role: 'ADMIN',
      isActive: true,
      name: 'Fardeen',
    },
    create: {
      phoneNumber: null,
      name: 'Fardeen',
      email: 'fardeen@riseandshine.nyc',
      role: 'ADMIN',
      isActive: true,
    },
  })

  // Admin 5: Fardeen (alternate email)
  const admin5 = await prisma.user.upsert({
    where: { email: 'fardeenhassansardar12@gmail.com' },
    update: {
      role: 'ADMIN',
      isActive: true,
      name: 'Fardeen',
    },
    create: {
      phoneNumber: null,
      name: 'Fardeen',
      email: 'fardeenhassansardar12@gmail.com',
      role: 'ADMIN',
      isActive: true,
    },
  })

  // Admin 6: Shazia
  const admin6 = await prisma.user.upsert({
    where: { email: 'shazia@riseandshine.nyc' },
    update: {
      role: 'ADMIN',
      isActive: true,
      name: 'Shazia',
    },
    create: {
      phoneNumber: null,
      name: 'Shazia',
      email: 'shazia@riseandshine.nyc',
      role: 'ADMIN',
      isActive: true,
    },
  })

  // Admin 7: Shazia (alternate email)
  const admin7 = await prisma.user.upsert({
    where: { email: 'shaziakhaliq37@gmail.com' },
    update: {
      role: 'ADMIN',
      isActive: true,
      name: 'Shazia',
    },
    create: {
      phoneNumber: null,
      name: 'Shazia',
      email: 'shaziakhaliq37@gmail.com',
      role: 'ADMIN',
      isActive: true,
    },
  })

  // Admin 8: Q. Hossain
  const admin8 = await prisma.user.upsert({
    where: { email: 'q.hossains055@gmail.com' },
    update: {
      role: 'ADMIN',
      isActive: true,
      name: 'Q. Hossain',
    },
    create: {
      phoneNumber: null,
      name: 'Q. Hossain',
      email: 'q.hossains055@gmail.com',
      role: 'ADMIN',
      isActive: true,
    },
  })

  // Admin 9: A. Karim
  const admin9 = await prisma.user.upsert({
    where: { email: 'azkarim05@gmail.com' },
    update: {
      role: 'ADMIN',
      isActive: true,
      name: 'A. Karim',
    },
    create: {
      phoneNumber: null,
      name: 'A. Karim',
      email: 'azkarim05@gmail.com',
      role: 'ADMIN',
      isActive: true,
    },
  })

  console.log('✅ Created/updated admin users:', {
    admin1: admin1.email,
    admin2: admin2.email,
    admin3: admin3.email,
    admin4: admin4.email,
    admin5: admin5.email,
    admin6: admin6.email,
    admin7: admin7.email,
    admin8: admin8.email,
    admin9: admin9.email,
  })

  console.log('🎉 Seed completed successfully!')
  console.log('📧 Admin emails configured:')
  console.log('   - aaronsiam21@gmail.com')
  console.log('   - kazi@siyam.nyc')
  console.log('   - tisha@riseandshine.nyc')
  console.log('   - fardeen@riseandshine.nyc')
  console.log('   - fardeenhassansardar12@gmail.com')
  console.log('   - shazia@riseandshine.nyc')
  console.log('   - shaziakhaliq37@gmail.com')
  console.log('   - q.hossains055@gmail.com')
  console.log('   - azkarim05@gmail.com')
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
