const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
})

async function test() {
  try {
    console.log('Testing database connection...')
    const result = await prisma.$queryRaw`SELECT current_user, current_database();`
    console.log('Connection successful!')
    console.log('User:', result[0]?.current_user)
    console.log('Database:', result[0]?.current_database)
    
    // Test OTP code creation
    console.log('\nTesting OTP code creation...')
    await prisma.otpCode.create({
      data: {
        email: 'test@test.com',
        code: '123456',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    })
    console.log('✅ OTP code created successfully!')
    
    // Clean up
    await prisma.otpCode.deleteMany({
      where: { email: 'test@test.com' },
    })
    console.log('✅ Cleanup successful!')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error('Full error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

test()

