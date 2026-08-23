import { getClientServicesUser, getVisibleClientsWhere } from '@/lib/crm/access'
import { prisma } from '@/lib/prisma'
import {
  loadOwnedClientIds,
  teamTaskVisibilityWhere,
} from '@/lib/crm/tasks/access'
import { TasksHubClient } from '@/components/crm/tasks/TasksHubClient'

export const dynamic = 'force-dynamic'

export default async function TeamTasksPage() {
  const user = await getClientServicesUser()
  const visibility = teamTaskVisibilityWhere(user)

  const [tasks, users, clients, ownedClientIds] = await Promise.all([
    prisma.teamTask.findMany({
      where: visibility,
      orderBy: [{ dueAt: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        assignedToUser: { select: { id: true, name: true, email: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
        serviceClient: {
          select: { id: true, firstName: true, lastName: true, clientCode: true },
        },
        subtasks: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.user.findMany({
      where: { email: { not: null } },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
    prisma.serviceClient.findMany({
      where: getVisibleClientsWhere(user),
      select: { id: true, firstName: true, lastName: true, clientCode: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 500,
    }),
    loadOwnedClientIds(user.id),
  ])

  return (
    <TasksHubClient
      initialTasks={tasks}
      users={users}
      clients={clients}
      ownedClientIds={ownedClientIds}
      currentUserId={user.id}
      fullAccess={user.fullAccess}
    />
  )
}
