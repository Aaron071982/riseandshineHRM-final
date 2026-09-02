import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { callMcpTool, MCP_TOOL_DEFINITIONS } from '@/lib/mcp/registry'

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'Rise and Shine HRM',
    version: '2.0.0',
  })

  for (const def of MCP_TOOL_DEFINITIONS) {
    server.registerTool(
      def.name,
      {
        description: def.description,
        inputSchema: z.object({}).passthrough(),
      },
      async (args) => callMcpTool(def.name, args as Record<string, unknown>)
    )
  }

  return server
}
