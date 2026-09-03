import { describe, expect, it } from 'vitest'
import { userCanReadClientDocuments } from '@/lib/mcp/documentAllowlist'
import { classifyDocumentReadableVia } from '@/lib/mcp/documentPolicy'
import {
  checkToolScopeAccess,
  MCP_SCOPE_PHI,
  MCP_SCOPE_PHI_DOCUMENTS,
  MCP_SCOPE_READ,
  MCP_SCOPE_WRITE,
} from '@/lib/mcp/scopes'

describe('document type policy', () => {
  it('classifies clinical docs as text', () => {
    expect(classifyDocumentReadableVia({ key: 'diagnostic_eval' })).toBe('text')
    expect(classifyDocumentReadableVia({ key: 'dsm5_checklist' })).toBe('text')
    expect(classifyDocumentReadableVia({ key: 'clinical_assessment' })).toBe('text')
    expect(classifyDocumentReadableVia({ label: 'Psychological evaluation' })).toBe('text')
  })

  it('classifies identity and insurance docs as link-only', () => {
    expect(classifyDocumentReadableVia({ key: 'parent_id' })).toBe('link')
    expect(classifyDocumentReadableVia({ key: 'insurance_card' })).toBe('link')
    expect(classifyDocumentReadableVia({ key: 'medicaid_card' })).toBe('link')
    expect(classifyDocumentReadableVia({ label: 'Parent/guardian photo ID' })).toBe('link')
  })

  it('fails closed on unknown types', () => {
    expect(classifyDocumentReadableVia({ key: 'mystery_scan' })).toBe('blocked')
    expect(classifyDocumentReadableVia({ key: '', label: '' })).toBe('blocked')
  })
})

describe('document-read allowlist', () => {
  it('allows explicit flag', () => {
    expect(
      userCanReadClientDocuments({
        id: 'u1',
        email: 'other@example.com',
        canReadClientDocuments: true,
        crmRoles: [],
      })
    ).toBe(true)
  })

  it('allows CRM SUPER_ADMIN and INTAKE without the flag', () => {
    expect(
      userCanReadClientDocuments({
        id: 'u2',
        email: 'cc@example.com',
        canReadClientDocuments: false,
        crmRoles: ['SUPER_ADMIN'],
      })
    ).toBe(true)
    expect(
      userCanReadClientDocuments({
        id: 'u3',
        email: 'intake@example.com',
        canReadClientDocuments: false,
        crmRoles: ['INTAKE'],
      })
    ).toBe(true)
  })

  it('denies staff without flag or qualifying role', () => {
    expect(
      userCanReadClientDocuments({
        id: 'u4',
        email: 'staff@example.com',
        canReadClientDocuments: false,
        crmRoles: ['CASE_COORDINATION'],
      })
    ).toBe(false)
  })
})

describe('mcp:phi:documents scope', () => {
  it('blocks read_document for static API key even with all scopes', () => {
    const result = checkToolScopeAccess({
      toolName: 'read_document',
      grantedScopes: new Set([
        MCP_SCOPE_READ,
        MCP_SCOPE_WRITE,
        MCP_SCOPE_PHI,
        MCP_SCOPE_PHI_DOCUMENTS,
      ]),
      authMethod: 'api_key',
    })
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toBe('api_key_documents_forbidden')
    }
  })

  it('blocks read_document when OAuth has mcp:phi but not mcp:phi:documents', () => {
    const result = checkToolScopeAccess({
      toolName: 'read_document',
      grantedScopes: new Set([MCP_SCOPE_READ, MCP_SCOPE_WRITE, MCP_SCOPE_PHI]),
      authMethod: 'oauth',
    })
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toBe('missing_mcp_phi_documents')
    }
  })

  it('allows list_client_documents with mcp:phi only', () => {
    expect(
      checkToolScopeAccess({
        toolName: 'list_client_documents',
        grantedScopes: new Set([MCP_SCOPE_READ, MCP_SCOPE_PHI]),
        authMethod: 'oauth',
      })
    ).toEqual({ allowed: true })
  })

  it('allows read_document when OAuth includes mcp:phi:documents', () => {
    expect(
      checkToolScopeAccess({
        toolName: 'read_document',
        grantedScopes: new Set([
          MCP_SCOPE_READ,
          MCP_SCOPE_PHI,
          MCP_SCOPE_PHI_DOCUMENTS,
        ]),
        authMethod: 'oauth',
      })
    ).toEqual({ allowed: true })
  })
})
