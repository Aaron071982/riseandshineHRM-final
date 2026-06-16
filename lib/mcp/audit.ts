import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getMcpSystemUserId } from '@/lib/mcp/systemUser'

export type McpToolCallLogInput = {
  toolName: string
  args: Record<string, unknown>
  resultSummary: Record<string, unknown>
}

function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    if (key === 'note' && typeof value === 'string') {
      sanitized[key] = `[${value.length} chars]`
    } else if (key === 'query' && typeof value === 'string') {
      sanitized[key] = value.includes('@') ? '[email query]' : `[query: ${value.length} chars]`
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

export async function logMcpToolCall(input: McpToolCallLogInput): Promise<void> {
  try {
    const userId = await getMcpSystemUserId()
    await prisma.activityLog.create({
      data: {
        userId,
        activityType: 'MCP_TOOL_CALL',
        action: input.toolName,
        resourceType: 'MCP',
        resourceId: input.toolName,
        metadata: {
          args: sanitizeArgs(input.args),
          resultSummary: input.resultSummary,
        } as Prisma.InputJsonValue,
      },
    })
  } catch (err) {
    console.error('[mcp-audit] Failed to log tool call:', err)
  }
}
