import type { ClientOwnerDept } from '@prisma/client'

/** Whether a task belongs on this user's "My tasks" list (client-safe). */
export function isMyTeamTask(
  task: {
    assignedToUserId: string | null
    assignedDept: ClientOwnerDept | null
    serviceClientId: string | null
    status: string
  },
  userId: string,
  ownedClientIds: ReadonlySet<string> | readonly string[]
): boolean {
  if (task.status === 'DONE') return false
  if (task.assignedToUserId === userId) return true
  // Standalone department pool tasks (claim from pool)
  if (!task.assignedToUserId && task.assignedDept && !task.serviceClientId) {
    return true
  }
  // Client-linked: show if user actively owns / claimed the client
  if (task.serviceClientId) {
    const owned =
      ownedClientIds instanceof Set
        ? ownedClientIds
        : new Set(ownedClientIds)
    if (owned.has(task.serviceClientId)) return true
  }
  return false
}
