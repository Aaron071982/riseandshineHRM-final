import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createMcpServer } from '@/lib/mcp/server'

type JsonRpcMessage = {
  method?: string
  id?: unknown
  jsonrpc?: string
}

function extractJsonRpcMessages(body: unknown): JsonRpcMessage[] {
  if (Array.isArray(body)) return body as JsonRpcMessage[]
  if (body && typeof body === 'object') return [body as JsonRpcMessage]
  return []
}

export function logMcpJsonRpcMethods(body: unknown, requestMethod: string): void {
  const messages = extractJsonRpcMessages(body)
  for (const msg of messages) {
    console.log(
      '[mcp][jsonrpc]',
      JSON.stringify({
        httpMethod: requestMethod,
        rpcMethod: msg.method ?? '(response)',
        id: msg.id ?? null,
      })
    )
  }
  if (messages.length === 0) {
    console.log('[mcp][jsonrpc]', JSON.stringify({ httpMethod: requestMethod, rpcMethod: '(unparseable body)' }))
  }
}

/**
 * Stateless Streamable HTTP handler for Vercel/serverless.
 * Uses JSON responses (not SSE) so each request completes before the function exits.
 */
export async function handleMcpProtocolRequest(
  request: Request,
  parsedBody?: unknown
): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  const server = createMcpServer()

  await server.connect(transport)

  try {
    const body = parsedBody ?? (await request.json().catch(() => null))
    if (body !== null && body !== undefined) {
      logMcpJsonRpcMethods(body, request.method)
    }

    const response = await transport.handleRequest(request, {
      parsedBody: body ?? undefined,
    })

    console.log(
      '[mcp][response]',
      JSON.stringify({
        status: response.status,
        contentType: response.headers.get('content-type'),
      })
    )

    return response
  } finally {
    await server.close().catch(() => {})
  }
}
