import { getCurrentUser } from '@/lib/auth'

export type RoleLike = 'ADMIN' | 'BCBA' | 'RBT' | 'BILLING' | 'MARKETING' | 'CALL_CENTER' | 'DEV'

interface PermissionContext {
  employeeId?: string
}

export async function requireUserWithRole(allowedRoles: RoleLike[]) {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('UNAUTHENTICATED')
  }
  if (!allowedRoles.includes(user.role as RoleLike)) {
    throw new Error('FORBIDDEN')
  }
  return user
}

export async function requireAdmin() {
  return requireUserWithRole(['ADMIN'])
}

