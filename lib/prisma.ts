import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Normalize DATABASE_URL for Supabase Pooler (Session or Transaction)
// Add connection pooling parameters if using pooler and they're not present
let databaseUrl = process.env.DATABASE_URL
if (databaseUrl.includes('pooler.supabase.com')) {
  const url = new URL(databaseUrl)
  
  // Check if using Transaction Pooler (port 6543) or Session Pooler (port 5432)
  const isTransactionPooler = url.port === '6543' || databaseUrl.includes(':6543')
  
  if (isTransactionPooler) {
    // Transaction Pooler: optimized for serverless, no pgbouncer param needed
    // But we still want connection limits for Vercel
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '1')
    }
  } else {
    // Session Pooler: needs pgbouncer=true for Prisma
    if (!url.searchParams.has('pgbouncer')) {
      url.searchParams.set('pgbouncer', 'true')
    }
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '1')
    }
  }
  
  // Add timeout parameters for serverless
  if (!url.searchParams.has('connect_timeout')) {
    url.searchParams.set('connect_timeout', '10')
  }
  
  databaseUrl = url.toString()
}

// Create Prisma client with optimized settings for Vercel serverless
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })

// Always cache in global to prevent multiple instances in serverless environments
// This is critical for Vercel's serverless functions
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma
}

// Graceful shutdown handling
if (process.env.NODE_ENV !== 'production') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}

