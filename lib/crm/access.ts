import type {
  ClientOwnerDept,
  ClientPipelineStatus,
  ClientStage,
  CrmRole,
  Prisma,
} from '@prisma/client'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { validateSession, type SessionUser } from '@/lib/auth'
import { getClientIpFromHeaders } from '@/lib/client-ip'
import { prisma } from '@/lib/prisma'
import {
  CS_SESSION_COOKIE,
  isClientServicesFullAccessEmail,
} from '@/lib/client-services/constants'
import { isSuperAdminEmail } from '@/lib/constants'
import { validateElevatedSession } from '@/lib/client-services/access'
import { logClientAccess } from '@/lib/client-services/audit'
import {
  CRM_DEPARTMENT_ROLES,
  CRM_ROLE_TO_OWNER_DEPT,
  OWNER_DEPT_TO_CRM_ROLE,
} from '@/lib/crm/roleConstants'

export {
  CRM_DEPARTMENT_ROLES,
  CRM_ROLE_TO_OWNER_DEPT,
  OWNER_DEPT_TO_CRM_ROLE,
} from '@/lib/crm/roleConstants'

export class CrmAccessError extends Error {
  status: number
  constructor(message: string, status = 403) {
    super(message)
    this.name = 'CrmAccessError'
    this.status = status
  }
}

export type CrmUser = SessionUser & {
  /** Active CrmRole values (revokedAt null). */
  crmRoles: CrmRole[]
  /** SUPER_ADMIN / MANAGEMENT / break-glass allowlist. */
  fullAccess: boolean
  /** SUPER_ADMIN CRM role or platform super-admin email allowlist. */
  superAdmin: boolean
}

export type CrmAccessSubject = {
  id: string
  email?: string | null
  crmRoles?: CrmRole[] | null
  fullAccess?: boolean
  superAdmin?: boolean
}

/** Active CRM roles for a user (DB). */
export async function fetchUserCrmRoles(userId: string): Promise<CrmRole[]> {
  const rows = await prisma.userCrmRole.findMany({
    where: { userId, revokedAt: null },
    select: { role: true },
  })
  return rows.map((r) => r.role)
}

/** Sync helper — uses `crmRoles` on the subject when present. */
export function getUserCrmRoles(user: CrmAccessSubject): CrmRole[] {
  return user.crmRoles ?? []
}

/**
 * CRM super-admin: active SUPER_ADMIN role, or break-glass email allowlist
 * (SUPER_ADMIN_EMAILS / platform owner).
 */
export function isSuperAdmin(user: CrmAccessSubject): boolean {
  if (user.superAdmin === true) return true
  if (getUserCrmRoles(user).includes('SUPER_ADMIN')) return true
  return isSuperAdminEmail(user.email)
}

/**
 * Full caseload access: SUPER_ADMIN / MANAGEMENT role, or Client Services
 * email allowlist break-glass.
 */
export function isFullAccess(user: CrmAccessSubject): boolean {
  if (user.fullAccess === true) return true
  const roles = getUserCrmRoles(user)
  if (roles.includes('SUPER_ADMIN') || roles.includes('MANAGEMENT')) return true
  return isClientServicesFullAccessEmail(user.email)
}

/** Department CrmRoles the user holds (excludes SUPER_ADMIN / MANAGEMENT). */
export function getUserDepartments(user: CrmAccessSubject): CrmRole[] {
  return getUserCrmRoles(user).filter((r) =>
    (CRM_DEPARTMENT_ROLES as readonly string[]).includes(r)
  )
}

export function ownerDeptsForUser(
  user: CrmAccessSubject
): ClientOwnerDept[] {
  const depts: ClientOwnerDept[] = []
  for (const role of getUserDepartments(user)) {
    const d = CRM_ROLE_TO_OWNER_DEPT[role]
    if (d && !depts.includes(d)) depts.push(d)
  }
  return depts
}

/**
 * Resolves the current user from the Client Services elevated session.
 * Redirects to login / elevate gate when missing.
 */
export async function getClientServicesUser(): Promise<CrmUser> {
  const cookieStore = await cookies()
  const mainToken = cookieStore.get('session')?.value
  if (!mainToken) redirect('/login')

  const base = await validateSession(mainToken)
  if (!base) redirect('/login')

  const csToken = cookieStore.get(CS_SESSION_COOKIE)?.value
  const elevated = await validateElevatedSession(csToken)
  if (!elevated) redirect('/client-services')

  const crmRoles = await fetchUserCrmRoles(elevated.id)
  const subject: CrmAccessSubject = {
    id: elevated.id,
    email: elevated.email,
    crmRoles,
  }

  return {
    ...elevated,
    crmRoles,
    fullAccess: isFullAccess(subject),
    superAdmin: isSuperAdmin(subject),
  }
}

/**
 * Prisma `where` for every client list/detail query.
 * - full-access → {}
 * - department member → owned cases plus stage-based cross-listed work
 * - CASE_COORDINATION → own caseload as well
 * - no CRM role and not allowlisted → deny-all
 */
export function getVisibleClientsWhere(
  user: CrmAccessSubject
): Prisma.ServiceClientWhereInput {
  if (isFullAccess(user)) return {}

  const roles = getUserCrmRoles(user)
  const depts = ownerDeptsForUser(user)
  const hasCaseCoordination = roles.includes('CASE_COORDINATION')

  if (depts.length === 0 && !hasCaseCoordination) {
    // No department visibility and not full-access → see nothing.
    // (Allowlist break-glass already returned {} above.)
    return { id: { in: [] } }
  }

  const or: Prisma.ServiceClientWhereInput[] = []
  if (depts.length > 0) {
    or.push({ currentOwnerDept: { in: depts } })
  }
  if (roles.includes('STAFFING')) {
    or.push({ stage: 'APPROVED', pipelineStatus: 'LIVE' })
  }
  if (hasCaseCoordination) {
    or.push({ stage: 'RBT_SEARCH', pipelineStatus: 'LIVE' })
    or.push({ caseCoordinatorUserId: user.id })
  }

  return or.length === 1 ? or[0]! : { OR: or }
}

export function canViewClientRecord(
  user: CrmAccessSubject,
  client: {
    caseCoordinatorUserId: string | null
    currentOwnerDept?: ClientOwnerDept | null
    stage?: ClientStage
    pipelineStatus?: ClientPipelineStatus
  }
): boolean {
  if (isFullAccess(user)) return true

  const roles = getUserCrmRoles(user)
  const depts = ownerDeptsForUser(user)
  if (
    client.currentOwnerDept &&
    depts.includes(client.currentOwnerDept)
  ) {
    return true
  }
  if (
    (client.pipelineStatus == null || client.pipelineStatus === 'LIVE') &&
    roles.includes('STAFFING') &&
    client.stage === 'APPROVED'
  ) {
    return true
  }
  if (
    (client.pipelineStatus == null || client.pipelineStatus === 'LIVE') &&
    roles.includes('CASE_COORDINATION') &&
    client.stage === 'RBT_SEARCH'
  ) {
    return true
  }
  if (
    roles.includes('CASE_COORDINATION') &&
    client.caseCoordinatorUserId === user.id
  ) {
    return true
  }
  return false
}

export function canEditClientRecord(
  user: CrmAccessSubject,
  client: {
    caseCoordinatorUserId: string | null
    currentOwnerDept?: ClientOwnerDept | null
    stage?: ClientStage
    pipelineStatus?: ClientPipelineStatus
  }
): boolean {
  return canViewClientRecord(user, client)
}

export async function assertCanViewClient(
  user: CrmAccessSubject,
  clientId: string
): Promise<{
  id: string
  caseCoordinatorUserId: string | null
  currentOwnerDept: ClientOwnerDept | null
}> {
  const client = await prisma.serviceClient.findFirst({
    where: { id: clientId, ...getVisibleClientsWhere(user) },
    select: {
      id: true,
      caseCoordinatorUserId: true,
      currentOwnerDept: true,
    },
  })
  if (!client) {
    throw new CrmAccessError('Forbidden', 403)
  }
  return client
}

export async function assertCanEditClient(
  user: CrmAccessSubject,
  clientId: string
): Promise<{
  id: string
  caseCoordinatorUserId: string | null
  currentOwnerDept: ClientOwnerDept | null
}> {
  return assertCanViewClient(user, clientId)
}

/** Server-side guard for Admin Management — throws CrmAccessError. */
export async function assertCrmSuperAdmin(
  user: CrmAccessSubject
): Promise<void> {
  if (!isSuperAdmin(user)) {
    throw new CrmAccessError('Super-admin access required', 403)
  }
}

/** True if user may open a department queue page for `dept`. */
export function canAccessDepartment(
  user: CrmAccessSubject,
  dept: ClientOwnerDept
): boolean {
  if (isFullAccess(user)) return true
  const role = OWNER_DEPT_TO_CRM_ROLE[dept]
  return getUserCrmRoles(user).includes(role)
}

/** Throws 403 if user cannot open the department page. */
export function assertCanAccessDepartment(
  user: CrmAccessSubject,
  dept: ClientOwnerDept
): void {
  if (!canAccessDepartment(user, dept)) {
    throw new CrmAccessError(`${dept} department access required`, 403)
  }
}

/**
 * True if user holds the role for the client's current owning department
 * (or is full-access). Used for claim / hand-off from within the dept.
 */
export function canActAsOwningDepartment(
  user: CrmAccessSubject,
  ownerDept: ClientOwnerDept | null
): boolean {
  if (isFullAccess(user)) return true
  if (!ownerDept) return false
  return getUserCrmRoles(user).includes(OWNER_DEPT_TO_CRM_ROLE[ownerDept])
}

export async function getRequestIp(): Promise<string | null> {
  const hdrs = await headers()
  return getClientIpFromHeaders(hdrs)
}

export async function auditClientAction(params: {
  userId: string
  serviceClientId?: string | null
  action: string
  ip?: string | null
}): Promise<void> {
  const ip = params.ip ?? (await getRequestIp())
  await logClientAccess({
    userId: params.userId,
    serviceClientId: params.serviceClientId,
    action: params.action,
    ip,
  })
}
