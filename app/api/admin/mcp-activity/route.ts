import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MCP_TOOL_NAMES } from '@/lib/mcp/registry'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const { searchParams } = request.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
  const tool = searchParams.get('tool') || ''
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const skip = (page - 1) * limit

  const where: {
    activityType: 'MCP_TOOL_CALL'
    action?: string
    createdAt?: { gte?: Date; lte?: Date }
  } = {
    activityType: 'MCP_TOOL_CALL',
  }

  if (tool && MCP_TOOL_NAMES.includes(tool as (typeof MCP_TOOL_NAMES)[number])) {
    where.action = tool
  }

  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = new Date(startDate)
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      where.createdAt.lte = end
    }
  }

  const [total, logs] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        action: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ])

  const items = logs.map((log) => {
    const meta = (log.metadata ?? {}) as {
      args?: Record<string, unknown>
      resultSummary?: Record<string, unknown>
    }
    return {
      id: log.id,
      tool: log.action,
      argsSummary: meta.args ?? {},
      resultSummary: meta.resultSummary ?? {},
      createdAt: log.createdAt.toISOString(),
    }
  })

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    tools: [...MCP_TOOL_NAMES],
  })
}
