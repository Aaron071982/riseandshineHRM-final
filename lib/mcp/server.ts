import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { callMcpTool, MCP_TOOL_DEFINITIONS } from '@/lib/mcp/registry'

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'Rise and Shine HRM',
    version: '1.0.0',
  })

  const defs = Object.fromEntries(MCP_TOOL_DEFINITIONS.map((t) => [t.name, t]))

  server.registerTool(
    'get_onboarding_status',
    {
      description: defs.get_onboarding_status.description,
      inputSchema: {
        stuckOnly: z.boolean().optional(),
        minDaysStuck: z.number().optional(),
      },
    },
    async (args) => callMcpTool('get_onboarding_status', args)
  )

  server.registerTool(
    'get_pipeline_stats',
    {
      description: defs.get_pipeline_stats.description,
      inputSchema: {},
    },
    async () => callMcpTool('get_pipeline_stats', {})
  )

  server.registerTool(
    'find_idle_hires',
    {
      description: defs.find_idle_hires.description,
      inputSchema: {
        includeNotTrained: z.boolean().optional(),
      },
    },
    async (args) => callMcpTool('find_idle_hires', args)
  )

  server.registerTool(
    'lookup_bt',
    {
      description: defs.lookup_bt.description,
      inputSchema: {
        query: z.string(),
      },
    },
    async (args) => callMcpTool('lookup_bt', args)
  )

  server.registerTool(
    'add_candidate_note',
    {
      description: defs.add_candidate_note.description,
      inputSchema: {
        rbtProfileId: z.string(),
        note: z.string(),
      },
    },
    async (args) => callMcpTool('add_candidate_note', args)
  )

  return server
}
