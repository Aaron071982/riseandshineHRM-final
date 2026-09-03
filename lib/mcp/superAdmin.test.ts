import { describe, expect, it } from 'vitest'
import { maskSensitiveDeep, maskSensitiveIdentifiers } from '@/lib/mcp/maskSensitive'
import {
  isMcpSuperAdminEmail,
  userIsMcpSuperAdmin,
} from '@/lib/mcp/superAdminAllowlist'
import {
  checkToolScopeAccess,
  MCP_SCOPE_PHI,
  MCP_SCOPE_READ,
  MCP_SCOPE_SUPERADMIN,
  MCP_SCOPE_WRITE,
} from '@/lib/mcp/scopes'

describe('mcp super-admin allowlist', () => {
  it('recognizes the five executive emails', () => {
    expect(isMcpSuperAdminEmail('irsal@riseandshineaba.com')).toBe(true)
    expect(isMcpSuperAdminEmail('kazi@riseandshineaba.com')).toBe(true)
    expect(isMcpSuperAdminEmail('siyam@riseandshineaba.com')).toBe(true)
    expect(isMcpSuperAdminEmail('shazia@riseandshineaba.com')).toBe(true)
    expect(isMcpSuperAdminEmail('fardeen@riseandshineaba.com')).toBe(true)
    expect(isMcpSuperAdminEmail('tisha@riseandshineaba.com')).toBe(false)
  })

  it('allows flag or named email', () => {
    expect(
      userIsMcpSuperAdmin({
        id: '1',
        email: 'staff@example.com',
        isMcpSuperAdmin: true,
      })
    ).toBe(true)
    expect(
      userIsMcpSuperAdmin({
        id: '2',
        email: 'irsal@riseandshineaba.com',
        isMcpSuperAdmin: false,
      })
    ).toBe(true)
    expect(
      userIsMcpSuperAdmin({
        id: '3',
        email: 'staff@example.com',
        isMcpSuperAdmin: false,
      })
    ).toBe(false)
  })
})

describe('mcp:superadmin scope', () => {
  it('blocks pay tools for API key', () => {
    const result = checkToolScopeAccess({
      toolName: 'get_staff_pay',
      grantedScopes: new Set([MCP_SCOPE_READ, MCP_SCOPE_SUPERADMIN]),
      authMethod: 'api_key',
    })
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.reason).toBe('api_key_superadmin_forbidden')
  })

  it('blocks pay tools without mcp:superadmin', () => {
    const result = checkToolScopeAccess({
      toolName: 'get_payroll_summary',
      grantedScopes: new Set([MCP_SCOPE_READ, MCP_SCOPE_WRITE, MCP_SCOPE_PHI]),
      authMethod: 'oauth',
    })
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.reason).toBe('missing_mcp_superadmin')
  })

  it('allows pay tools with mcp:superadmin over OAuth', () => {
    expect(
      checkToolScopeAccess({
        toolName: 'get_staff_worked_sessions',
        grantedScopes: new Set([MCP_SCOPE_READ, MCP_SCOPE_SUPERADMIN]),
        authMethod: 'oauth',
      })
    ).toEqual({ allowed: true })
  })

  it('lets mcp:superadmin satisfy mcp:phi for CRM tools', () => {
    expect(
      checkToolScopeAccess({
        toolName: 'lookup_client',
        grantedScopes: new Set([MCP_SCOPE_READ, MCP_SCOPE_SUPERADMIN]),
        authMethod: 'oauth',
      })
    ).toEqual({ allowed: true })
  })
})

describe('identifier masking', () => {
  it('masks SSN and keeps pay amounts', () => {
    const text = maskSensitiveIdentifiers(
      'SSN 123-45-6789 paid $1,234.56 routing acct: 987654321012'
    )
    expect(text).toContain('***-**-6789')
    expect(text).toContain('$1,234.56')
    expect(text).not.toContain('123-45-6789')
    expect(text).toMatch(/\*{4}\d{4}/)
  })

  it('masks deep object keys that look like account numbers', () => {
    const masked = maskSensitiveDeep({
      bankAccount: '123456789012',
      grossPay: 500,
      note: 'card 4111111111111111',
    })
    expect(masked.grossPay).toBe(500)
    expect(String(masked.bankAccount)).toMatch(/\*{4}9012/)
    expect(String(masked.note)).not.toContain('4111111111111111')
  })
})
