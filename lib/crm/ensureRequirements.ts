import type { ClientStage, RequirementGroup, RequirementType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  CANONICAL_DOCUMENTS,
  DOCUMENT_BY_KEY,
  isDocumentRequired,
  LEGACY_DOCUMENT_KEY_MAP,
} from '@/lib/crm/documents'
import {
  CLIENT_STAGE_ORDER,
  REQUIREMENT_KEY_LABELS,
  STAGE_GATE_REQUIREMENT_KEYS,
} from '@/lib/crm/stages'

const RETIRED_REQUIREMENT_KEYS = new Set(['vineland', 'fast_assessment'])

export type RequirementSeed = {
  key: string
  label: string
  stage: ClientStage
  type: RequirementType
  group: RequirementGroup
  isRequiredToAdvance: boolean
}

/** Full checklist: canonical documents + stage gate tasks (deduped by key). */
export function buildRequirementSeedCatalog(
  insuranceProvider?: string | null
): Map<string, RequirementSeed> {
  const catalog = new Map<string, RequirementSeed>()

  for (const doc of CANONICAL_DOCUMENTS) {
    catalog.set(doc.key, {
      key: doc.key,
      label: doc.label,
      stage: doc.stage,
      type: doc.type,
      group: doc.group,
      isRequiredToAdvance: isDocumentRequired(doc, insuranceProvider),
    })
  }

  for (const stage of CLIENT_STAGE_ORDER) {
    for (const key of STAGE_GATE_REQUIREMENT_KEYS[stage]) {
      if (catalog.has(key)) continue
      const doc = DOCUMENT_BY_KEY[key]
      catalog.set(key, {
        key,
        label: doc?.label ?? REQUIREMENT_KEY_LABELS[key] ?? key.replace(/_/g, ' '),
        stage: doc?.stage ?? stage,
        type: (doc?.type ?? 'TASK') as RequirementType,
        group: doc?.group ?? 'STAGE',
        isRequiredToAdvance: doc ? isDocumentRequired(doc, insuranceProvider) : true,
      })
    }
  }

  return catalog
}

type ExistingRow = {
  id: string
  key: string
  label: string
  stage: ClientStage
  type: RequirementType
  group: RequirementGroup
  isRequiredToAdvance: boolean
}

/**
 * Ensure every client has the full requirement catalog (documents + stage gates).
 * Repairs legacy import rows (wrong group/stage/key). Never changes status.
 */
export async function ensureClientRequirements(
  serviceClientId: string
): Promise<{ created: number; updated: number }> {
  const client = await prisma.serviceClient.findUnique({
    where: { id: serviceClientId },
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
  if (!client) return { created: 0, updated: 0 }

  const seedCatalog = buildRequirementSeedCatalog(client.insuranceProvider)
  const byKey = new Map<string, ExistingRow>(
    client.requirements.map((r) => [r.key, r])
  )
  let created = 0
  let updated = 0

  for (const row of client.requirements) {
    const mapped = LEGACY_DOCUMENT_KEY_MAP[row.key]
    if (!mapped || mapped === row.key) continue

    if (byKey.has(mapped)) {
      await prisma.clientRequirement.update({
        where: { id: row.id },
        data: { deletedAt: new Date() },
      })
      byKey.delete(row.key)
      updated++
      continue
    }

    const seed = seedCatalog.get(mapped)
    if (!seed) continue

    await prisma.clientRequirement.update({
      where: { id: row.id },
      data: {
        key: mapped,
        label: seed.label,
        stage: seed.stage,
        type: seed.type,
        group: seed.group,
        isRequiredToAdvance: seed.isRequiredToAdvance,
      },
    })
    byKey.delete(row.key)
    byKey.set(mapped, {
      ...row,
      key: mapped,
      label: seed.label,
      stage: seed.stage,
      type: seed.type,
      group: seed.group,
      isRequiredToAdvance: seed.isRequiredToAdvance,
    })
    updated++
  }

  for (const row of byKey.values()) {
    if (!RETIRED_REQUIREMENT_KEYS.has(row.key)) continue
    await prisma.clientRequirement.update({
      where: { id: row.id },
      data: { deletedAt: new Date() },
    })
    byKey.delete(row.key)
    updated++
  }

  for (const row of byKey.values()) {
    const seed = seedCatalog.get(row.key)
    if (!seed) continue
    const needsUpdate =
      row.label !== seed.label ||
      row.stage !== seed.stage ||
      row.type !== seed.type ||
      row.group !== seed.group ||
      row.isRequiredToAdvance !== seed.isRequiredToAdvance
    if (!needsUpdate) continue

    await prisma.clientRequirement.update({
      where: { id: row.id },
      data: {
        label: seed.label,
        stage: seed.stage,
        type: seed.type,
        group: seed.group,
        isRequiredToAdvance: seed.isRequiredToAdvance,
      },
    })
    updated++
  }

  for (const seed of seedCatalog.values()) {
    if (byKey.has(seed.key)) continue
    await prisma.clientRequirement.create({
      data: {
        serviceClientId,
        key: seed.key,
        label: seed.label,
        stage: seed.stage,
        type: seed.type,
        group: seed.group,
        status: 'PENDING',
        isRequiredToAdvance: seed.isRequiredToAdvance,
      },
    })
    created++
  }

  return { created, updated }
}
