import { prisma } from '@/lib/prisma'
import { userAudienceKeys } from '@/lib/org-training/audience'

export type MatrixPerson = {
  userId: string
  name: string | null
  email: string | null
  role: string
  crmRoles: string[]
}

export type MatrixModuleCol = {
  id: string
  title: string
  required: boolean
  audienceRoles: string[]
}

export type MatrixCellStatus = 'complete' | 'outstanding' | 'n/a'

export type OrgTrainingMatrix = {
  modules: MatrixModuleCol[]
  people: MatrixPerson[]
  /** people[i] × modules[j] */
  cells: MatrixCellStatus[][]
}

/**
 * People × required ACTIVE modules completion matrix.
 * Includes users whose role/CRM roles intersect any required module audience.
 */
export async function buildOrgTrainingMatrix(): Promise<OrgTrainingMatrix> {
  const modules = await prisma.orgTrainingModule.findMany({
    where: { status: 'ACTIVE', required: true },
    orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
    select: {
      id: true,
      title: true,
      required: true,
      audienceRoles: true,
    },
  })

  if (modules.length === 0) {
    return { modules: [], people: [], cells: [] }
  }

  const audienceSet = new Set(modules.flatMap((m) => m.audienceRoles))
  const userRoleKeys = Array.from(audienceSet).filter((k) =>
    ['RBT', 'BCBA', 'BILLING', 'MARKETING', 'CALL_CENTER', 'TRAINER', 'ADMIN'].includes(
      k
    )
  )
  const crmRoleKeys = Array.from(audienceSet).filter((k) =>
    [
      'INTAKE',
      'CLINICAL',
      'AUTHORIZATION',
      'STAFFING',
      'CASE_COORDINATION',
      'BILLING',
      'SUPER_ADMIN',
      'MANAGEMENT',
    ].includes(k)
  )

  const users = await prisma.user.findMany({
    where: {
      OR: [
        ...(userRoleKeys.length
          ? [{ role: { in: userRoleKeys as never[] } }]
          : []),
        ...(crmRoleKeys.length
          ? [
              {
                crmRoles: {
                  some: {
                    revokedAt: null,
                    role: { in: crmRoleKeys as never[] },
                  },
                },
              },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      crmRoles: {
        where: { revokedAt: null },
        select: { role: true },
      },
    },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
    take: 2000,
  })

  const people: MatrixPerson[] = users
    .map((u) => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      crmRoles: u.crmRoles.map((r) => r.role),
    }))
    .filter((p) => {
      const keys = userAudienceKeys({ role: p.role, crmRoles: p.crmRoles })
      return modules.some((m) =>
        m.audienceRoles.some((r) => keys.includes(r.toUpperCase()))
      )
    })

  const completions = await prisma.orgTrainingCompletion.findMany({
    where: {
      moduleId: { in: modules.map((m) => m.id) },
      userId: { in: people.map((p) => p.userId) },
    },
    select: { moduleId: true, userId: true },
  })
  const done = new Set(completions.map((c) => `${c.userId}:${c.moduleId}`))

  const cells: MatrixCellStatus[][] = people.map((p) => {
    const keys = new Set(
      userAudienceKeys({ role: p.role, crmRoles: p.crmRoles }).map((k) =>
        k.toUpperCase()
      )
    )
    return modules.map((m) => {
      const assigned = m.audienceRoles.some((r) => keys.has(r.toUpperCase()))
      if (!assigned) return 'n/a'
      return done.has(`${p.userId}:${m.id}`) ? 'complete' : 'outstanding'
    })
  })

  return {
    modules: modules.map((m) => ({
      id: m.id,
      title: m.title,
      required: m.required,
      audienceRoles: m.audienceRoles,
    })),
    people,
    cells,
  }
}

export function orgTrainingMatrixToCsv(matrix: OrgTrainingMatrix): string {
  const escape = (v: string) => {
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
    return v
  }
  const header = [
    'Name',
    'Email',
    'UserRole',
    'CrmRoles',
    ...matrix.modules.map((m) => m.title),
  ]
  const rows = matrix.people.map((p, i) => {
    const cells = matrix.cells[i] ?? []
    return [
      p.name ?? '',
      p.email ?? '',
      p.role,
      p.crmRoles.join(';'),
      ...cells.map((c) =>
        c === 'complete' ? 'Complete' : c === 'outstanding' ? 'Outstanding' : 'N/A'
      ),
    ]
  })
  return [header, ...rows].map((r) => r.map(escape).join(',')).join('\n')
}
