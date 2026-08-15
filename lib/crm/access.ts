import type { Prisma } from '@prisma/client'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { validateSession, type SessionUser } from '@/lib/auth'
import { getClientIpFromHeaders } from '@/lib/client-ip'
import { prisma } from '@/lib/prisma'
import {
  CS_SESSION_COOKIE,
  isClientServicesFullAccessEmail,
} from '@/lib/client-services/constants'
import { validateElevatedSession } from '@/lib/client-services/access'
import { logClientAccess } from '@/lib/client-services/audit'

export class CrmAccessError extends Error {
  status: number
  constructor(message: string, status = 403) {
    super(message)
    this.name = 'CrmAccessError'
    this.status = status
  }
}

export type CrmUser = SessionUser & {
  /** True when email is on CLIENT_SERVICES_FULL_ACCESS_EMAILS (and related allowlist). */
  fullAccess: boolean
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

  return {
    ...elevated,
    fullAccess: isFullAccess(elevated),
  }
}

/** True if the user's email is on the Client Services full-access allowlist. */
export function isFullAccess(user: { email?: string | null }): boolean {
  return isClientServicesFullAccessEmail(user.email)
}

/**
 * Prisma `where` for every client list/detail query.
 * Full-access → no filter. Coordinators → only their assigned clients.
 *
 * // TODO: coordinator role source — today "not full-access + valid session"
 * means coordinator (scoped). Nobody hits this branch yet (everyone with a
 * CS session is on CLIENT_SERVICES_FULL_ACCESS_EMAILS), but the path is live.
 */
export function getVisibleClientsWhere(
  user: CrmUser | SessionUser
): Prisma.ServiceClientWhereInput {
  if (isFullAccess(user)) return {}
  // TODO: coordinator role source — replace with explicit role/flag when ready.
  return { caseCoordinatorUserId: user.id }
}

export function canViewClientRecord(
  user: CrmUser | SessionUser,
  client: { caseCoordinatorUserId: string | null }
): boolean {
  if (isFullAccess(user)) return true
  // TODO: coordinator role source
  return client.caseCoordinatorUserId === user.id
}

export function canEditClientRecord(
  user: CrmUser | SessionUser,
  client: { caseCoordinatorUserId: string | null }
): boolean {
  return canViewClientRecord(user, client)
}

export async function assertCanViewClient(
  user: CrmUser | SessionUser,
  clientId: string
): Promise<{ id: string; caseCoordinatorUserId: string | null }> {
  const client = await prisma.serviceClient.findFirst({
    where: { id: clientId, ...getVisibleClientsWhere(user) },
    select: { id: true, caseCoordinatorUserId: true },
  })
  if (!client) {
    throw new CrmAccessError('Forbidden', 403)
  }
  return client
}

export async function assertCanEditClient(
  user: CrmUser | SessionUser,
  clientId: string
): Promise<{ id: string; caseCoordinatorUserId: string | null }> {
  // Same visibility rule today; keep a dedicated entry point so every mutation
  // explicitly re-checks write access server-side.
  return assertCanViewClient(user, clientId)
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
