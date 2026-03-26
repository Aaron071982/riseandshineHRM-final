import { NextResponse } from 'next/server'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const SETUP_MESSAGE_TABLE =
  'The org_nodes table is missing. In Supabase (or your DB), run the SQL in prisma/scripts/create-org-nodes-table.sql, then refresh this page.'

const SETUP_MESSAGE_RLS =
  'The org_nodes table exists but access was denied (often RLS). Run prisma/supabase-rls-policies-app.sql for your app role, or grant SELECT on org_nodes to the role used by DATABASE_URL.'

const SETUP_MESSAGE_PRISMA_CLIENT =
  'The Prisma client is out of sync. Stop the dev server, run: npx prisma generate, then start again.'

const SETUP_MESSAGE_DB_UNREACHABLE =
  'Cannot reach the database. Check DATABASE_URL, Supabase status, and network. If using the pooler, verify sslmode and connection settings in lib/prisma.ts.'

function prismaErrorCode(e: unknown): string | undefined {
  if (e && typeof e === 'object' && 'code' in e) {
    const c = (e as { code?: string | number }).code
    if (typeof c === 'string') return c
    if (typeof c === 'number') return String(c)
  }
  return undefined
}

function hasOrgNodeDelegate(): boolean {
  const p = prisma as unknown as { orgNode?: { findMany?: unknown } }
  return typeof p.orgNode?.findMany === 'function'
}

/** Table missing — Prisma P2021. Always check `.code` (instanceof breaks across bundles). */
function isOrgNodesTableMissing(e: unknown): boolean {
  if (prismaErrorCode(e) === 'P2021') {
    return true
  }
  if (e instanceof PrismaClientKnownRequestError && e.code === 'P2021') {
    return true
  }
  const msg = String((e as Error)?.message ?? '')
  const lower = msg.toLowerCase()
  if (/org_nodes/i.test(msg) && /does not exist|not exist in the current database/i.test(lower)) {
    return true
  }
  return (
    (lower.includes('relation') && lower.includes('does not exist') && lower.includes('org_nodes')) ||
    lower.includes('unknown table')
  )
}

function isOrgNodesPermissionDenied(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? '').toLowerCase()
  if (!msg.includes('permission denied') && !msg.includes('42501')) return false
  return msg.includes('org_nodes') || msg.includes('orgnode')
}

function isDbUnreachable(e: unknown): boolean {
  const code = prismaErrorCode(e)
  if (code === 'P1001' || code === 'P1000') return true
  const msg = String((e as Error)?.message ?? '').toLowerCase()
  return msg.includes("can't reach database") || msg.includes('connection refused') || msg.includes('econnrefused')
}

const linkedUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  rbtProfile: { select: { id: true } },
} as const

const orderByOrg = [{ parentId: 'asc' as const }, { sortOrder: 'asc' as const }, { name: 'asc' as const }]

function fallbackMessageForUnknownError(e: unknown): string {
  const base =
    'Could not load org chart data. Confirm org_nodes exists (see prisma/scripts/create-org-nodes-table.sql), run npx prisma generate, and restart the dev server.'
  if (process.env.NODE_ENV !== 'development') return base
  const detail = e instanceof Error ? e.message : String(e)
  return `${base} (${detail})`
}

export async function GET() {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  if (!hasOrgNodeDelegate()) {
    console.warn('GET /api/admin/org-chart: prisma.orgNode delegate missing')
    return NextResponse.json({
      nodes: [],
      setupRequired: true,
      setupMessage: SETUP_MESSAGE_PRISMA_CLIENT,
    })
  }

  try {
    const nodes = await prisma.orgNode.findMany({
      orderBy: orderByOrg,
      include: {
        linkedUser: {
          select: linkedUserSelect,
        },
      },
    })

    return NextResponse.json({ nodes })
  } catch (e) {
    if (isOrgNodesTableMissing(e)) {
      console.warn('GET /api/admin/org-chart: org_nodes missing / P2021')
      return NextResponse.json({
        nodes: [],
        setupRequired: true,
        setupMessage: SETUP_MESSAGE_TABLE,
      })
    }
    if (isOrgNodesPermissionDenied(e)) {
      console.warn('GET /api/admin/org-chart: permission denied on org_nodes')
      return NextResponse.json({
        nodes: [],
        setupRequired: true,
        setupMessage: SETUP_MESSAGE_RLS,
      })
    }
    if (isDbUnreachable(e)) {
      console.warn('GET /api/admin/org-chart: database unreachable', prismaErrorCode(e))
      return NextResponse.json({
        nodes: [],
        setupRequired: true,
        setupMessage: SETUP_MESSAGE_DB_UNREACHABLE,
      })
    }

    console.warn('GET /api/admin/org-chart: primary query failed, retrying without linkedUser include', prismaErrorCode(e), (e as Error)?.message)

    try {
      const bare = await prisma.orgNode.findMany({
        orderBy: orderByOrg,
      })
      const nodes = bare.map((n) => ({
        ...n,
        linkedUser: null,
      }))
      return NextResponse.json({ nodes })
    } catch (e2) {
      console.error('GET /api/admin/org-chart: fallback query failed', prismaErrorCode(e2), (e2 as Error)?.message, e2)
      return NextResponse.json({
        nodes: [],
        setupRequired: true,
        setupMessage: fallbackMessageForUnknownError(e2),
      })
    }
  }
}
