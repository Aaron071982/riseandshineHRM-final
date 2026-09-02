import type { Prisma } from '@prisma/client'

/** All RBTs in the hiring pipeline through hired (excludes fired/rejected). */
export const MAP_THERAPIST_WHERE: Prisma.RBTProfileWhereInput = {
  status: { notIn: ['FIRED', 'REJECTED'] },
}
