import type {
  AuthStatus,
  AuthType,
  ClientOwnerDept,
  ClientPipelineStatus,
  ClientStage,
  CrmRole,
  GenderPreference,
  Prisma,
  RequirementStatus,
} from '@prisma/client'
import { CLIENT_STAGE_ORDER } from '@/lib/crm/stages'
import { isMedicaidPayer } from '@/lib/crm/documents'
import { authExpiryBefore } from '@/lib/crm/thresholds'

/** Whitelisted filter fields — never accept arbitrary Prisma `where` from the client. */
export const QUERY_FILTER_FIELDS = [
  'stage',
  'pipelineStatus',
  'currentOwnerDept',
  'caseCoordinatorUserId',
  'bcbaProfileId',
  'payerType',
  'hasRbtAssignment',
  'hasMissingRequirement',
  'authType',
  'authStatus',
  'authBand',
  'city',
  'borough',
  'preferredRbtGender',
  'stageAgeDaysMin',
  'createdAtFrom',
  'createdAtTo',
  'language', // not tracked on ServiceClient — rejected with clear error if used
] as const

export type QueryFilterField = (typeof QUERY_FILTER_FIELDS)[number]

export type QueryFilterOp = 'eq' | 'neq' | 'in' | 'true' | 'false' | 'gte' | 'lte'

export type QueryFilterClause = {
  field: QueryFilterField
  op: QueryFilterOp
  value?: string | string[] | number | boolean | null
}

export type QueryFilterGroup = {
  op: 'AND' | 'OR'
  clauses: Array<QueryFilterClause | QueryFilterGroup>
}

export type QueryBuilderError = {
  code: 'UNKNOWN_FIELD' | 'INVALID_VALUE' | 'NOT_TRACKED' | 'INVALID_TREE'
  message: string
  field?: string
}

const STAGES = new Set<string>(CLIENT_STAGE_ORDER)
const PIPELINES = new Set<string>(['LIVE', 'ON_HOLD', 'DISCHARGED', 'LOST'])
const DEPTS = new Set<string>([
  'INTAKE',
  'CASE_COORDINATION',
  'CLINICAL',
  'AUTHORIZATION',
  'STAFFING',
  'BILLING',
])
const AUTH_TYPES = new Set<string>(['ASSESSMENT', 'TREATMENT'])
const AUTH_STATUSES = new Set<string>([
  'REQUESTED',
  'PENDING',
  'APPROVED',
  'DENIED',
  'EXPIRED',
])
const AUTH_BANDS = new Set<string>(['45', '30', '14', '7', '0', 'expired'])
const GENDERS = new Set<string>(['MALE', 'FEMALE', 'ANY'])

function isGroup(
  node: QueryFilterClause | QueryFilterGroup
): node is QueryFilterGroup {
  return (
    typeof node === 'object' &&
    node != null &&
    'op' in node &&
    (node.op === 'AND' || node.op === 'OR') &&
    Array.isArray((node as QueryFilterGroup).clauses)
  )
}

function isClause(
  node: QueryFilterClause | QueryFilterGroup
): node is QueryFilterClause {
  return (
    typeof node === 'object' &&
    node != null &&
    'field' in node &&
    typeof (node as QueryFilterClause).field === 'string'
  )
}

export function parseFilterTree(raw: unknown): QueryFilterGroup | QueryBuilderError {
  if (!raw || typeof raw !== 'object') {
    return { code: 'INVALID_TREE', message: 'Filter must be an object' }
  }
  const node = raw as QueryFilterGroup
  if (!isGroup(node)) {
    return { code: 'INVALID_TREE', message: 'Root filter must be an AND/OR group' }
  }
  const walk = (g: QueryFilterGroup): QueryBuilderError | null => {
    if (g.clauses.length === 0) {
      return { code: 'INVALID_TREE', message: 'Filter group cannot be empty' }
    }
    for (const c of g.clauses) {
      if (isGroup(c)) {
        const err = walk(c)
        if (err) return err
      } else if (isClause(c)) {
        if (!(QUERY_FILTER_FIELDS as readonly string[]).includes(c.field)) {
          return {
            code: 'UNKNOWN_FIELD',
            message: `Field "${c.field}" is not whitelisted`,
            field: c.field,
          }
        }
        if (c.field === 'language') {
          return {
            code: 'NOT_TRACKED',
            message:
              'Client preferred language is not tracked on service_clients yet',
            field: 'language',
          }
        }
      } else {
        return { code: 'INVALID_TREE', message: 'Invalid clause in filter tree' }
      }
    }
    return null
  }
  const err = walk(node)
  if (err) return err
  return node
}

function asStringArray(value: unknown): string[] | null {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
    return value as string[]
  }
  return null
}

function clauseToWhere(
  clause: QueryFilterClause
): Prisma.ServiceClientWhereInput | QueryBuilderError {
  const { field, op, value } = clause

  switch (field) {
    case 'stage': {
      const vals = asStringArray(value)
      if (!vals?.length || !vals.every((v) => STAGES.has(v))) {
        return { code: 'INVALID_VALUE', message: 'Invalid stage value', field }
      }
      if (op === 'eq') return { stage: vals[0] as ClientStage }
      if (op === 'in') return { stage: { in: vals as ClientStage[] } }
      if (op === 'neq') return { stage: { not: vals[0] as ClientStage } }
      return { code: 'INVALID_VALUE', message: `Unsupported op ${op} for stage`, field }
    }
    case 'pipelineStatus': {
      const vals = asStringArray(value)
      if (!vals?.length || !vals.every((v) => PIPELINES.has(v))) {
        return { code: 'INVALID_VALUE', message: 'Invalid pipelineStatus', field }
      }
      if (op === 'eq') return { pipelineStatus: vals[0] as ClientPipelineStatus }
      if (op === 'in')
        return { pipelineStatus: { in: vals as ClientPipelineStatus[] } }
      return { code: 'INVALID_VALUE', message: `Unsupported op ${op}`, field }
    }
    case 'currentOwnerDept': {
      const vals = asStringArray(value)
      if (!vals?.length || !vals.every((v) => DEPTS.has(v))) {
        return { code: 'INVALID_VALUE', message: 'Invalid currentOwnerDept', field }
      }
      if (op === 'eq') return { currentOwnerDept: vals[0] as ClientOwnerDept }
      if (op === 'in')
        return { currentOwnerDept: { in: vals as ClientOwnerDept[] } }
      return { code: 'INVALID_VALUE', message: `Unsupported op ${op}`, field }
    }
    case 'caseCoordinatorUserId': {
      if (op === 'eq' && (value === null || value === '')) {
        return { caseCoordinatorUserId: null }
      }
      const vals = asStringArray(value)
      if (!vals?.length) {
        return { code: 'INVALID_VALUE', message: 'Invalid caseCoordinatorUserId', field }
      }
      if (op === 'eq') return { caseCoordinatorUserId: vals[0] }
      if (op === 'in') return { caseCoordinatorUserId: { in: vals } }
      return { code: 'INVALID_VALUE', message: `Unsupported op ${op}`, field }
    }
    case 'bcbaProfileId': {
      if (op === 'eq' && (value === null || value === '')) {
        return { bcbaProfileId: null }
      }
      const vals = asStringArray(value)
      if (!vals?.length) {
        return { code: 'INVALID_VALUE', message: 'Invalid bcbaProfileId', field }
      }
      if (op === 'eq') return { bcbaProfileId: vals[0] }
      if (op === 'in') return { bcbaProfileId: { in: vals } }
      return { code: 'INVALID_VALUE', message: `Unsupported op ${op}`, field }
    }
    case 'payerType': {
      const vals = asStringArray(value)
      const kind = (vals?.[0] || '').toLowerCase()
      if (kind !== 'medicaid' && kind !== 'commercial') {
        return {
          code: 'INVALID_VALUE',
          message: 'payerType must be medicaid or commercial',
          field,
        }
      }
      // Approximate: Medicaid-like payer names vs everything else with a payer set.
      if (kind === 'medicaid') {
        return {
          OR: [
            { insuranceProvider: { contains: 'medicaid', mode: 'insensitive' } },
            { insuranceProvider: { contains: 'fidelis', mode: 'insensitive' } },
            { insuranceProvider: { contains: 'healthfirst', mode: 'insensitive' } },
            { insuranceProvider: { contains: 'metroplus', mode: 'insensitive' } },
          ],
        }
      }
      return {
        AND: [
          { insuranceProvider: { not: null } },
          { NOT: { insuranceProvider: { equals: '' } } },
          {
            NOT: {
              OR: [
                { insuranceProvider: { contains: 'medicaid', mode: 'insensitive' } },
                { insuranceProvider: { contains: 'fidelis', mode: 'insensitive' } },
                { insuranceProvider: { contains: 'healthfirst', mode: 'insensitive' } },
                { insuranceProvider: { contains: 'metroplus', mode: 'insensitive' } },
              ],
            },
          },
        ],
      }
    }
    case 'hasRbtAssignment': {
      const want = op === 'true' || value === true || value === 'true'
      if (want) {
        return {
          scheduleAssignments: {
            some: { deletedAt: null, isActive: true },
          },
        }
      }
      return {
        scheduleAssignments: {
          none: { deletedAt: null, isActive: true },
        },
      }
    }
    case 'hasMissingRequirement': {
      const want = op === 'true' || value === true || value === 'true'
      const missing: RequirementStatus = 'MISSING'
      if (want) {
        return {
          requirements: {
            some: { deletedAt: null, status: missing },
          },
        }
      }
      return {
        requirements: {
          none: { deletedAt: null, status: missing },
        },
      }
    }
    case 'authType':
    case 'authStatus':
    case 'authBand': {
      const authWhere: Prisma.ClientAuthorizationWhereInput = {
        deletedAt: null,
      }
      if (field === 'authType') {
        const vals = asStringArray(value)
        if (!vals?.length || !vals.every((v) => AUTH_TYPES.has(v))) {
          return { code: 'INVALID_VALUE', message: 'Invalid authType', field }
        }
        authWhere.authType = vals[0] as AuthType
      }
      if (field === 'authStatus') {
        const vals = asStringArray(value)
        if (!vals?.length || !vals.every((v) => AUTH_STATUSES.has(v))) {
          return { code: 'INVALID_VALUE', message: 'Invalid authStatus', field }
        }
        authWhere.status = vals[0] as AuthStatus
      }
      if (field === 'authBand') {
        const vals = asStringArray(value)
        const band = vals?.[0]
        if (!band || !AUTH_BANDS.has(band)) {
          return { code: 'INVALID_VALUE', message: 'Invalid authBand', field }
        }
        if (band === 'expired') {
          authWhere.expirationDate = { lt: new Date() }
        } else {
          const days = Number(band)
          const upper = authExpiryBefore(days)
          const lowerBandIdx = (AUTH_BANDS_ORDER as readonly string[]).indexOf(
            band
          )
          const nextLower =
            lowerBandIdx < AUTH_BANDS_ORDER.length - 1
              ? Number(AUTH_BANDS_ORDER[lowerBandIdx + 1])
              : null
          if (nextLower == null || Number.isNaN(nextLower)) {
            authWhere.expirationDate = {
              gte: new Date(),
              lte: upper,
            }
          } else {
            const lower = authExpiryBefore(nextLower)
            authWhere.expirationDate = {
              gt: lower,
              lte: upper,
            }
          }
        }
      }
      return { authorizations: { some: authWhere } }
    }
    case 'city': {
      const vals = asStringArray(value)
      if (!vals?.[0]) {
        return { code: 'INVALID_VALUE', message: 'city required', field }
      }
      return { city: { equals: vals[0], mode: 'insensitive' } }
    }
    case 'borough': {
      const vals = asStringArray(value)
      if (!vals?.[0]) {
        return { code: 'INVALID_VALUE', message: 'borough required', field }
      }
      return { borough: { equals: vals[0], mode: 'insensitive' } }
    }
    case 'preferredRbtGender': {
      const vals = asStringArray(value)
      if (!vals?.length || !vals.every((v) => GENDERS.has(v))) {
        return { code: 'INVALID_VALUE', message: 'Invalid preferredRbtGender', field }
      }
      return { preferredRbtGender: vals[0] as GenderPreference }
    }
    case 'stageAgeDaysMin': {
      const n = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(n) || n < 0) {
        return { code: 'INVALID_VALUE', message: 'stageAgeDaysMin must be ≥ 0', field }
      }
      const before = new Date()
      before.setHours(0, 0, 0, 0)
      before.setDate(before.getDate() - Math.floor(n))
      return { stageEnteredAt: { lte: before } }
    }
    case 'createdAtFrom': {
      const d = new Date(String(value ?? ''))
      if (Number.isNaN(d.getTime())) {
        return { code: 'INVALID_VALUE', message: 'Invalid createdAtFrom', field }
      }
      return { createdAt: { gte: d } }
    }
    case 'createdAtTo': {
      const d = new Date(String(value ?? ''))
      if (Number.isNaN(d.getTime())) {
        return { code: 'INVALID_VALUE', message: 'Invalid createdAtTo', field }
      }
      return { createdAt: { lte: d } }
    }
    case 'language':
      return {
        code: 'NOT_TRACKED',
        message: 'Client preferred language is not tracked yet',
        field,
      }
    default:
      return {
        code: 'UNKNOWN_FIELD',
        message: `Field "${field}" is not whitelisted`,
        field,
      }
  }
}

const AUTH_BANDS_ORDER = ['45', '30', '14', '7', '0'] as const

function combine(
  op: 'AND' | 'OR',
  parts: Prisma.ServiceClientWhereInput[]
): Prisma.ServiceClientWhereInput {
  if (parts.length === 0) return {}
  if (parts.length === 1) return parts[0]!
  return op === 'AND' ? { AND: parts } : { OR: parts }
}

function groupToWhere(
  group: QueryFilterGroup
): Prisma.ServiceClientWhereInput | QueryBuilderError {
  const parts: Prisma.ServiceClientWhereInput[] = []
  for (const node of group.clauses) {
    if (isGroup(node)) {
      const nested = groupToWhere(node)
      if ('code' in nested) return nested
      parts.push(nested)
    } else {
      const w = clauseToWhere(node)
      if ('code' in w) return w
      parts.push(w)
    }
  }
  return combine(group.op, parts)
}

/**
 * Translate a whitelist filter tree into Prisma where.
 * Caller MUST AND this with `getVisibleClientsWhere(user)`.
 */
export function filterTreeToWhere(
  raw: unknown
):
  | { ok: true; where: Prisma.ServiceClientWhereInput }
  | { ok: false; error: QueryBuilderError } {
  const parsed = parseFilterTree(raw)
  if ('code' in parsed) return { ok: false, error: parsed }
  const where = groupToWhere(parsed)
  if ('code' in where) return { ok: false, error: where }
  return { ok: true, where }
}

/** Re-export for UI / docs. */
export type { CrmRole }

/** Helper used by tests — medicaid check stays consistent with documents.ts */
export function classifyPayerType(
  insuranceProvider: string | null | undefined
): 'medicaid' | 'commercial' | 'unknown' {
  if (!insuranceProvider?.trim()) return 'unknown'
  return isMedicaidPayer(insuranceProvider) ? 'medicaid' : 'commercial'
}
