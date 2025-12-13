import { PrismaClient } from '@prisma/client'
import { PrismaClientKnownRequestError, PrismaClientInitializationError } from '@prisma/client/runtime/library'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Helper to log Prisma connection info (without exposing secrets)
function logConnectionInfo(databaseUrl: string) {
  try {
    const url = new URL(databaseUrl)
    const connectionInfo = {
      host: url.hostname,
      port: url.port,
      database: url.pathname,
      hasPooler: url.hostname.includes('pooler'),
      isTransactionPooler: url.port === '6543',
      isSessionPooler: url.port === '5432',
      hasPgbouncer: url.searchParams.has('pgbouncer'),
      hasConnectionLimit: url.searchParams.has('connection_limit'),
      hasConnectTimeout: url.searchParams.has('connect_timeout'),
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    }
    console.log('[Prisma] Connection configuration:', JSON.stringify(connectionInfo, null, 2))
  } catch (error) {
    // If URL parsing fails, just log that we have a URL
    console.log('[Prisma] DATABASE_URL is set but could not parse URL structure')
  }
}

// Enhanced error logging for Prisma
export function logPrismaError(context: string, error: unknown) {
  const errorInfo: any = {
    context,
    timestamp: new Date().toISOString(),
    category: 'prisma_error',
  }

  if (error instanceof PrismaClientKnownRequestError) {
    errorInfo.type = 'PrismaClientKnownRequestError'
    errorInfo.code = error.code
    errorInfo.meta = error.meta
    errorInfo.message = error.message
    
    // Special handling for common error codes
    if (error.code === 'P1001') {
      errorInfo.diagnosis = 'Cannot reach database server. Check DATABASE_URL, network restrictions, and database status.'
    } else if (error.code === 'P2002') {
      errorInfo.diagnosis = 'Unique constraint violation. A record with this value already exists.'
    } else if (error.code === 'P2025') {
      errorInfo.diagnosis = 'Record not found. The requested record does not exist.'
    }
  } else if (error instanceof PrismaClientInitializationError) {
    errorInfo.type = 'PrismaClientInitializationError'
    errorInfo.errorCode = (error as any).errorCode
    errorInfo.message = error.message
    errorInfo.diagnosis = 'Prisma Client initialization failed. Check DATABASE_URL and database connectivity.'
  } else if (error instanceof Error) {
    errorInfo.type = error.constructor.name
    errorInfo.message = error.message
    if (process.env.NODE_ENV === 'development') {
      errorInfo.stack = error.stack
    }
  } else {
    errorInfo.rawError = String(error)
  }

  console.error(`[Prisma Error] ${context}:`, JSON.stringify(errorInfo, null, 2))
}

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  const error = new Error('DATABASE_URL environment variable is not set')
  console.error('[Prisma] Configuration error:', {
    error: error.message,
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
  throw error
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

// Log connection info on initialization (only in production to help debug)
if (process.env.NODE_ENV === 'production') {
  logConnectionInfo(databaseUrl)
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
    errorFormat: 'pretty',
  })

// Note: Prisma errors are best handled at the query level
// Use logPrismaError() in try-catch blocks around Prisma queries

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

