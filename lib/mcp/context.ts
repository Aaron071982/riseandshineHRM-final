import { AsyncLocalStorage } from 'node:async_hooks'
import type { McpAuthContext } from '@/lib/mcp-auth'

const mcpAuthStorage = new AsyncLocalStorage<McpAuthContext>()

export function runWithMcpAuth<T>(context: McpAuthContext, fn: () => T): T {
  return mcpAuthStorage.run(context, fn)
}

export function getMcpAuthContext(): McpAuthContext | undefined {
  return mcpAuthStorage.getStore()
}

export function requireMcpAuthContext(): McpAuthContext {
  const ctx = getMcpAuthContext()
  if (!ctx) {
    throw new Error('MCP auth context missing')
  }
  return ctx
}
