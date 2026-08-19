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
import { prisma, isPrismaMissingSchemaError } from '@/lib/prisma'
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
import { NOT_DELETED } from '@/lib/crm/softDelete'

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
  try {
    const rows = await prisma.userCrmRole.findMany({
      where: { userId, revokedAt: null },
      select: { role: true },
    })
    return rows.map((r) => r.role)
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) {
      console.warn(
        '[crm] user_crm_roles is missing — run prisma db push. Falling back to email allowlist.'
      )
      return []
    }
    throw error
  }
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
 * Next.js implements redirect()/notFound() as thrown errors. Catch-all
 * `fail()` helpers in server actions must rethrow them or the UI shows
 * "Something went wrong" instead of following the redirect.
 */
export function rethrowIfNextControlFlow(err: unknown): void {
  if (
    typeof err !== 'object' ||
    err === null ||
    !('digest' in err) ||
    typeof (err as { digest: unknown }).digest !== 'string'
  ) {
    return
  }
  const digest = (err as { digest: string }).digest
  if (digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND')) {
    throw err
  }
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
  const elevated = await validateElevatedSession(csToken, base)
  // Never redirect to /client-services — this function is also called while
  // rendering that route. A self-redirect loops HandleRedirect and blanks the page.
  if (!elevated) {
    throw new CrmAccessError('Client Services step-up required', 401)
  }

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

/** Pages under the CS layout: render nothing so ElevateGate can show. */
export async function getClientServicesPageUser(): Promise<CrmUser | null> {
  try {
    return await getClientServicesUser()
  } catch (err) {
    if (err instanceof CrmAccessError && err.status === 401) return null
    throw err
  }
}

/**
 * Prisma `where` for the Clients tab / caseload.
 * - full-access → all live (not deleted) clients
 * - everyone else → clients they have ever claimed (including released grants)
 * - no grant + not full-access → deny-all
 */
export function getVisibleClientsWhere(
  user: CrmAccessSubject
): Prisma.ServiceClientWhereInput {
  if (isFullAccess(user)) return { ...NOT_DELETED }
  if (!user.id) return { id: { in: [] } }
  return {
    AND: [{ ...NOT_DELETED }, { claims: { some: { userId: user.id } } }],
  }
}

export type ClientAccessSnapshot = {
  caseCoordinatorUserId: string | null
  currentOwnerDept?: ClientOwnerDept | null
  stage?: ClientStage
  pipelineStatus?: ClientPipelineStatus
  /** Any client_claims row for this user (including released). */
  hasClaimGrant?: boolean
}

/**
 * View = full-visibility OR an ever-claim grant.
 * A department role alone is not enough to open a profile.
 */
export function canViewClientRecord(
  user: CrmAccessSubject,
  client: ClientAccessSnapshot
): boolean {
  if (isFullAccess(user)) return true
  return client.hasClaimGrant === true
}

/**
 * Act = view access AND (full-visibility, assigned CC, or role for the
 * department that currently owns the client).
 */
export function canEditClientRecord(
  user: CrmAccessSubject,
  client: ClientAccessSnapshot
): boolean {
  if (isFullAccess(user)) return true
  if (!canViewClientRecord(user, client)) return false
  if (
    getUserCrmRoles(user).includes('CASE_COORDINATION') &&
    client.caseCoordinatorUserId === user.id
  ) {
    return true
  }
  return canActAsOwningDepartment(user, client.currentOwnerDept ?? null)
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
    where: { id: clientId, ...NOT_DELETED },
    select: {
      id: true,
      caseCoordinatorUserId: true,
      currentOwnerDept: true,
      claims: {
        where: { userId: user.id },
        select: { id: true },
        take: 1,
      },
    },
  })
  if (!client) {
    throw new CrmAccessError('Forbidden', 403)
  }
  if (
    !canViewClientRecord(user, {
      caseCoordinatorUserId: client.caseCoordinatorUserId,
      currentOwnerDept: client.currentOwnerDept,
      hasClaimGrant: client.claims.length > 0,
    })
  ) {
    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'PROFILE_DENIED',
    })
    throw new CrmAccessError('Forbidden', 403)
  }
  return {
    id: client.id,
    caseCoordinatorUserId: client.caseCoordinatorUserId,
    currentOwnerDept: client.currentOwnerDept,
  }
}

export async function assertCanEditClient(
  user: CrmAccessSubject,
  clientId: string
): Promise<{
  id: string
  caseCoordinatorUserId: string | null
  currentOwnerDept: ClientOwnerDept | null
}> {
  const client = await prisma.serviceClient.findFirst({
    where: { id: clientId, ...NOT_DELETED },
    select: {
      id: true,
      caseCoordinatorUserId: true,
      currentOwnerDept: true,
      claims: {
        where: { userId: user.id },
        select: { id: true, releasedAt: true },
        take: 5,
      },
    },
  })
  if (!client) {
    throw new CrmAccessError('Forbidden', 403)
  }
  const snapshot: ClientAccessSnapshot = {
    caseCoordinatorUserId: client.caseCoordinatorUserId,
    currentOwnerDept: client.currentOwnerDept,
    hasClaimGrant: client.claims.length > 0,
  }
  if (!canViewClientRecord(user, snapshot)) {
    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'PROFILE_DENIED',
    })
    throw new CrmAccessError('Forbidden', 403)
  }
  if (!canEditClientRecord(user, snapshot)) {
    throw new CrmAccessError(
      'View-only — this client is not currently owned by your department',
      403
    )
  }
  return {
    id: client.id,
    caseCoordinatorUserId: client.caseCoordinatorUserId,
    currentOwnerDept: client.currentOwnerDept,
  }
}

/** Server-side guard for Admin Management — throws CrmAccessError. */
export async function assertCrmSuperAdmin(
  user: CrmAccessSubject
): Promise<void> {
  if (!isSuperAdmin(user)) {
    throw new CrmAccessError('Super-admin access required', 403)
  }
}

/**
 * Weekly schedule board + import: staffing, case-coordination, or full-access.
 * Intake/clinical/auth/billing do not get the board unless they also hold one of those.
 */
export function canAccessCrmSchedule(user: CrmAccessSubject): boolean {
  if (isFullAccess(user)) return true
  const roles = getUserCrmRoles(user)
  return roles.includes('STAFFING') || roles.includes('CASE_COORDINATION')
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
