/**
 * Remap live client_requirements keys to the canonical document set.
 * Additive: never deletes rows. Dry-run by default.
 *
 *   dotenv -e .env.development -- tsx scripts/migrate-requirement-keys.ts
 *   dotenv -e .env.development -- tsx scripts/migrate-requirement-keys.ts --confirm
 */
import { PrismaClient } from '@prisma/client'
import { assertWriteTarget } from '../lib/scripts/guard'
import {
  CANONICAL_DOCUMENTS,
  DOCUMENT_BY_KEY,
  isDocumentRequired,
  LEGACY_DOCUMENT_KEY_MAP,
} from '../lib/crm/documents'
import { REQUIREMENT_KEY_LABELS } from '../lib/crm/stages'

const prisma = new PrismaClient()

async function main() {
  const target = assertWriteTarget({ allowProd: true })

  const clients = await prisma.serviceClient.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      insuranceProvider: true,
      requirements: {
        where: { deletedAt: null },
        select: {
          id: true,
          key: true,
          label: true,
          stage: true,
          type: true,
          group: true,
          isRequiredToAdvance: true,
        },
      },
    },
  })

  let renamed = 0
  let updated = 0
  let inserted = 0
  let skippedRename = 0

  for (const client of clients) {
    const keys = new Set(client.requirements.map((r) => r.key))

    for (const row of client.requirements) {
      const mapped = LEGACY_DOCUMENT_KEY_MAP[row.key]
      if (mapped && mapped !== row.key) {
        if (keys.has(mapped)) {
          skippedRename++
          console.log(
            `  skip rename ${row.key} → ${mapped} (already exists) client=${client.id}`
          )
          continue
        }
        const catalog = DOCUMENT_BY_KEY[mapped]
        if (!target.dryRun) {
          await prisma.clientRequirement.update({
            where: { id: row.id },
            data: {
              key: mapped,
              label: catalog?.label ?? REQUIREMENT_KEY_LABELS[mapped] ?? mapped,
              stage: catalog?.stage ?? row.stage,
              type: catalog?.type ?? row.type,
              group: catalog?.group ?? row.group,
              isRequiredToAdvance: catalog
                ? isDocumentRequired(catalog, client.insuranceProvider)
                : row.isRequiredToAdvance,
            },
          })
        }
        keys.delete(row.key)
        keys.add(mapped)
        renamed++
        row.key = mapped
      }
    }

    for (const row of client.requirements) {
      const catalog = DOCUMENT_BY_KEY[row.key]
      if (!catalog) continue
      const required = isDocumentRequired(catalog, client.insuranceProvider)
      const needsUpdate =
        row.label !== catalog.label ||
        row.stage !== catalog.stage ||
        row.type !== catalog.type ||
        row.group !== catalog.group ||
        row.isRequiredToAdvance !== required
      if (!needsUpdate) continue
      if (!target.dryRun) {
        await prisma.clientRequirement.update({
          where: { id: row.id },
          data: {
            label: catalog.label,
            stage: catalog.stage,
            type: catalog.type,
            group: catalog.group,
            isRequiredToAdvance: required,
          },
        })
      }
      updated++
    }

    for (const doc of CANONICAL_DOCUMENTS) {
      if (keys.has(doc.key)) continue
      if (!target.dryRun) {
        await prisma.clientRequirement.create({
          data: {
            serviceClientId: client.id,
            key: doc.key,
            label: doc.label,
            stage: doc.stage,
            type: doc.type,
            group: doc.group,
            status: 'PENDING',
            isRequiredToAdvance: isDocumentRequired(
              doc,
              client.insuranceProvider
            ),
          },
        })
      }
      keys.add(doc.key)
      inserted++
    }
  }

  console.log('\n═══ Requirement key migration ═══')
  console.log(`  clients: ${clients.length}`)
  console.log(`  renamed (legacy→canonical): ${renamed}`)
  console.log(`  skipped rename (target exists): ${skippedRename}`)
  console.log(`  metadata updated: ${updated}`)
  console.log(`  missing canonical inserted: ${inserted}`)
  console.log(
    target.dryRun
      ? '  (dry-run — no writes)'
      : '  writes applied'
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
