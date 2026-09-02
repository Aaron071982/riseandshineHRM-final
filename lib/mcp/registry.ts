import { logMcpToolCall } from '@/lib/mcp/audit'
import { requireMcpAuthContext } from '@/lib/mcp/context'
import {
  checkToolScopeAccess,
  scopeDenialMessage,
} from '@/lib/mcp/scopes'
import {
  isImplementedMcpTool,
  type McpV1ToolName,
} from '@/lib/mcp/toolNames'
import { addCandidateNote } from '@/lib/mcp/tools/addCandidateNote'
import { findIdleHires } from '@/lib/mcp/tools/findIdleHires'
import { getOnboardingStatus } from '@/lib/mcp/tools/getOnboardingStatus'
import { getPipelineStats } from '@/lib/mcp/tools/getPipelineStats'
import { lookupBt } from '@/lib/mcp/tools/lookupBt'
import type { ToolResult } from '@/lib/mcp/types'

export { MCP_V1_TOOL_NAMES as MCP_TOOL_NAMES } from '@/lib/mcp/toolNames'
export type { McpV1ToolName as McpToolName } from '@/lib/mcp/toolNames'

export const MCP_TOOL_DEFINITIONS = [
  {
    name: 'get_onboarding_status',
    description:
      'Returns hired RBTs and their onboarding progress, including who is stuck and which documents or tasks they are missing.',
    inputSchema: {
      type: 'object',
      properties: {
        stuckOnly: {
          type: 'boolean',
          description: 'If true, only return RBTs stuck more than 7 days in onboarding.',
        },
        minDaysStuck: {
          type: 'number',
          description: 'Filter by minimum days in current onboarding state.',
        },
      },
    },
  },
  {
    name: 'get_pipeline_stats',
    description:
      'Returns live pipeline and operational statistics: candidate counts by status, hired count, actively working count, idle hires, onboarding completion rate, upcoming interviews count.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'find_idle_hires',
    description:
      'Returns hired RBTs who are NOT actively working — they have status HIRED but no active client assignments. These need client matching.',
    inputSchema: {
      type: 'object',
      properties: {
        includeNotTrained: {
          type: 'boolean',
          description:
            'Include RBTs who have not completed Artemis training (default: false, excludes untrained).',
        },
      },
    },
  },
  {
    name: 'lookup_bt',
    description: 'Look up a specific BT or candidate by name or email and return their full details.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Name or email to search.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'add_candidate_note',
    description:
      'Adds an internal note to a candidate\'s or BT\'s profile timeline. Used to flag follow-ups. This writes a permanent note to the profile. Only call after the user has explicitly confirmed.',
    inputSchema: {
      type: 'object',
      properties: {
        rbtProfileId: { type: 'string', description: 'RBT profile ID.' },
        note: { type: 'string', description: 'Note text to save on the profile.' },
      },
      required: ['rbtProfileId', 'note'],
    },
  },
] as const

async function executeTool(
  name: McpV1ToolName,
  args: Record<string, unknown>
): Promise<ToolResult> {
  switch (name) {
    case 'get_onboarding_status':
      return getOnboardingStatus({
        stuckOnly: args.stuckOnly === true,
        minDaysStuck: typeof args.minDaysStuck === 'number' ? args.minDaysStuck : undefined,
      })
    case 'get_pipeline_stats':
      return getPipelineStats()
    case 'find_idle_hires':
      return findIdleHires({ includeNotTrained: args.includeNotTrained === true })
    case 'lookup_bt':
      return lookupBt({ query: String(args.query ?? '') })
    case 'add_candidate_note':
      return addCandidateNote({
        rbtProfileId: String(args.rbtProfileId ?? ''),
        note: String(args.note ?? ''),
      })
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

export async function callMcpTool(
  name: string,
  args: Record<string, unknown> = {}
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const auth = requireMcpAuthContext()

  const access = checkToolScopeAccess({
    toolName: name,
    grantedScopes: auth.scopes,
    authMethod: auth.method,
  })
  if (!access.allowed) {
    const message = scopeDenialMessage(access.reason)
    await logMcpToolCall({
      toolName: name,
      args,
      resultSummary: { error: true, reason: access.reason },
      authMethod: auth.method,
      clientId: auth.clientId,
      tokenHashPrefix: auth.tokenHash?.slice(0, 8),
    })
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    }
  }

  if (!isImplementedMcpTool(name)) {
    const message = `Tool not implemented yet: ${name}`
    await logMcpToolCall({
      toolName: name,
      args,
      resultSummary: { error: true, message },
      authMethod: auth.method,
      clientId: auth.clientId,
      tokenHashPrefix: auth.tokenHash?.slice(0, 8),
    })
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    }
  }

  const toolName = name
  const auditMeta = {
    authMethod: auth.method,
    clientId: auth.clientId,
    tokenHashPrefix: auth.tokenHash?.slice(0, 8),
  }

  try {
    const result = await executeTool(toolName, args)
    await logMcpToolCall({
      toolName,
      args,
      resultSummary: result.summary,
      ...auditMeta,
    })
    return {
      content: [{ type: 'text', text: result.text }],
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Tool execution failed'
    await logMcpToolCall({
      toolName,
      args,
      resultSummary: { error: true, message },
      ...auditMeta,
    })
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    }
  }
}

export function listMcpTools() {
  return MCP_TOOL_DEFINITIONS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }))
}
