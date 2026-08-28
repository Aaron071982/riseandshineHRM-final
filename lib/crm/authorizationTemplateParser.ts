/**
 * Parser seam for PA authorization templates.
 * Aaron will provide the template format — implement parseAuthorizationTemplate() then.
 */

export type AuthorizationTemplateField = {
  key: string
  label: string
  value: string
}

export type ParsedAuthorizationTemplate = {
  fields: AuthorizationTemplateField[]
  /** Raw parser notes for staff (non-PHI diagnostics). */
  parserVersion: string
}

/** Stub — returns empty fields until template spec is wired. */
export function parseAuthorizationTemplate(_bytes: Buffer): ParsedAuthorizationTemplate {
  return {
    fields: [],
    parserVersion: 'stub-v0',
  }
}
