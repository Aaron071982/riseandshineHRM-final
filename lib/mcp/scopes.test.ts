import { describe, expect, it } from 'vitest'
import { sanitizeMcpArgs } from '@/lib/mcp/audit'
import {
  checkToolScopeAccess,
  MCP_SCOPE_PHI,
  MCP_SCOPE_READ,
  MCP_SCOPE_WRITE,
  scopeDenialMessage,
} from '@/lib/mcp/scopes'

describe('lib/mcp/scopes', () => {
  it('allows v1 HR tools with mcp:read for OAuth', () => {
    const scopes = new Set([MCP_SCOPE_READ, MCP_SCOPE_WRITE])
    expect(
      checkToolScopeAccess({
        toolName: 'get_pipeline_stats',
        grantedScopes: scopes,
        authMethod: 'oauth',
      })
    ).toEqual({ allowed: true })
  })

  it('blocks PHI tools for static API key', () => {
    const scopes = new Set([MCP_SCOPE_READ, MCP_SCOPE_WRITE])
    const result = checkToolScopeAccess({
      toolName: 'lookup_client',
      grantedScopes: scopes,
      authMethod: 'api_key',
    })
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toBe('api_key_phi_forbidden')
      expect(scopeDenialMessage(result.reason)).toMatch(/mcp:phi/i)
    }
  })

  it('blocks PHI tools when OAuth token lacks mcp:phi', () => {
    const scopes = new Set([MCP_SCOPE_READ, MCP_SCOPE_WRITE])
    const result = checkToolScopeAccess({
      toolName: 'lookup_client',
      grantedScopes: scopes,
      authMethod: 'oauth',
    })
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toBe('missing_mcp_phi')
    }
  })

  it('allows PHI tools when OAuth token includes mcp:phi', () => {
    const scopes = new Set([MCP_SCOPE_READ, MCP_SCOPE_WRITE, MCP_SCOPE_PHI])
    expect(
      checkToolScopeAccess({
        toolName: 'lookup_client',
        grantedScopes: scopes,
        authMethod: 'oauth',
      })
    ).toEqual({ allowed: true })
  })

  it('requires mcp:write for add_candidate_note', () => {
    const scopes = new Set([MCP_SCOPE_READ])
    const result = checkToolScopeAccess({
      toolName: 'add_candidate_note',
      grantedScopes: scopes,
      authMethod: 'oauth',
    })
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toBe('missing_mcp_write')
    }
  })
})

describe('sanitizeMcpArgs', () => {
  it('keeps client IDs but redacts names, emails, and note bodies', () => {
    expect(
      sanitizeMcpArgs({
        clientId: 'cl_abc123',
        query: 'Jane Doe',
        parentEmail: 'parent@example.com',
        parentPhone: '718-555-0100',
        note: 'Follow up next week',
      })
    ).toEqual({
      clientId: 'cl_abc123',
      query: '[query: 8 chars]',
      parentEmail: '[email redacted]',
      parentPhone: '[phone redacted]',
      note: '[19 chars]',
    })
  })
})
