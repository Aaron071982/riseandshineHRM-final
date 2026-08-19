/**
 * Backfill client_claims from existing currentOwnerUserId / caseCoordinatorUserId.
 * Additive: never deletes grants or ownership. Dry-run by default.
 *
 *   dotenv -e .env.development -- tsx scripts/migrate-client-claims.ts
 *   dotenv -e .env.development -- tsx scripts/migrate-client-claims.ts --confirm
 */
import { PrismaClient } from '@prisma/client'
import { assertWriteTarget } from '../lib/scripts/guard'

const prisma = new PrismaClient()

async function main() {
  const target = assertWriteTarget({ allowProd: true })

  const clients = await prisma.serviceClient.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      currentOwnerUserId: true,
      caseCoordinatorUserId: true,
    },
  })

  let claimCreated = 0
  let assignedCreated = 0
  let skippedClaim = 0
  let skippedAssigned = 0

  for (const client of clients) {
    if (client.currentOwnerUserId) {
      const existing = await prisma.clientClaim.findFirst({
        where: {
          serviceClientId: client.id,
          userId: client.currentOwnerUserId,
          source: 'CLAIM',
          releasedAt: null,
        },
        select: { id: true },
      })
      if (existing) {
        skippedClaim++
      } else {
        if (!target.dryRun) {
          await prisma.clientClaim.create({
            data: {
              serviceClientId: client.id,
              userId: client.currentOwnerUserId,
              source: 'CLAIM',
              claimedByUserId: client.currentOwnerUserId,
            },
          })
        }
        claimCreated++
      }
    }

    if (client.caseCoordinatorUserId) {
      const existing = await prisma.clientClaim.findFirst({
        where: {
          serviceClientId: client.id,
          userId: client.caseCoordinatorUserId,
          source: 'ASSIGNED',
          releasedAt: null,
        },
        select: { id: true },
      })
      if (existing) {
        skippedAssigned++
      } else {
        if (!target.dryRun) {
          await prisma.clientClaim.create({
            data: {
              serviceClientId: client.id,
              userId: client.caseCoordinatorUserId,
              source: 'ASSIGNED',
              claimedByUserId: client.caseCoordinatorUserId,
            },
          })
        }
        assignedCreated++
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        clients: clients.length,
        claimCreated,
        assignedCreated,
        skippedClaim,
        skippedAssigned,
        dryRun: target.dryRun,
      },
      null,
      2
    )
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
