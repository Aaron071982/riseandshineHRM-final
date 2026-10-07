/**
 * Files legacy e-signed Form I-9 PDFs (old "I-9" onboarding doc, stored under
 * `rbts/<rbtProfileId>/<legacyDocId>/…` in the onboarding-documents bucket) into
 * `rbt_documents` as I9_FORM so they appear in the admin Documents section.
 *
 * Additive only: never deletes or rewrites existing rows, never touches
 * onboarding_completions. Skips files already filed (same filePath).
 * Stamps `i9Section1CompletedAt` (only when empty) from the legacy completion date.
 *
 * Usage: npx tsx scripts/backfill-legacy-i9-documents.ts [--apply]
 */
import { prisma } from '@/lib/prisma'
import { I9_DOCUMENT_TYPE, mimeTypeFromFileName } from '@/lib/rbtDocumentsSync'

const LEGACY_I9_DOCUMENT_ID = 'cmjz30kkn0006mn8jyi3gb6dd'

type StorageRow = { name: string; created_at: Date }

async function main() {
  const apply = process.argv.includes('--apply')

  const files = await prisma.$queryRaw<StorageRow[]>`
    SELECT name, created_at
    FROM storage.objects
    WHERE bucket_id = 'onboarding-documents'
      AND name LIKE ${`rbts/%/${LEGACY_I9_DOCUMENT_ID}/%`}
    ORDER BY created_at ASC
  `

  const profileIds = Array.from(new Set(files.map((f) => f.name.split('/')[1])))
  const [profiles, existingDocs, legacyCompletions] = await Promise.all([
    prisma.rBTProfile.findMany({
      where: { id: { in: profileIds } },
      select: { id: true, firstName: true, lastName: true, status: true, i9Section1CompletedAt: true },
    }),
    prisma.rBTDocument.findMany({
      where: { filePath: { in: files.map((f) => f.name) } },
      select: { filePath: true },
    }),
    prisma.onboardingCompletion.findMany({
      where: { documentId: LEGACY_I9_DOCUMENT_ID, rbtProfileId: { in: profileIds } },
      select: { rbtProfileId: true, completedAt: true },
    }),
  ])
  const profileById = new Map(profiles.map((p) => [p.id, p]))
  const alreadyFiled = new Set(existingDocs.map((d) => d.filePath))
  const legacyCompletedAt = new Map(legacyCompletions.map((c) => [c.rbtProfileId, c.completedAt]))

  const orphans: string[] = []
  const stamped = new Set<string>()
  let filed = 0
  let skipped = 0

  for (const file of files) {
    const profileId = file.name.split('/')[1]
    const profile = profileById.get(profileId)
    if (!profile) {
      orphans.push(file.name)
      continue
    }
    if (alreadyFiled.has(file.name)) {
      skipped++
      continue
    }

    const fileName = file.name.split('/').pop() || 'form-i9.pdf'
    const label = `${profile.firstName} ${profile.lastName} [${profile.status}]`
    const stampAt =
      profile.i9Section1CompletedAt || stamped.has(profile.id)
        ? null
        : legacyCompletedAt.get(profile.id) ?? file.created_at

    console.log(
      `${apply ? 'FILING' : 'would file'}: ${label} — ${fileName}` +
        (stampAt ? ` (Section 1 completed ${stampAt.toISOString().slice(0, 10)})` : '')
    )
    filed++
    if (stampAt) stamped.add(profile.id)
    if (!apply) continue

    await prisma.$transaction([
      prisma.rBTDocument.create({
        data: {
          rbtProfileId: profile.id,
          fileName: `Form I-9 (legacy e-sign) ${fileName}`,
          fileType: mimeTypeFromFileName(fileName),
          fileData: '',
          filePath: file.name,
          documentType: I9_DOCUMENT_TYPE,
          uploadedAt: file.created_at,
        },
      }),
      ...(stampAt
        ? [
            prisma.rBTProfile.update({
              where: { id: profile.id },
              data: { i9Section1CompletedAt: stampAt },
            }),
          ]
        : []),
      prisma.rBTAuditLog.create({
        data: {
          rbtProfileId: profile.id,
          auditType: 'COMPLIANCE',
          dateTime: new Date(),
          notes: `Legacy Form I-9 filed into Documents from storage (${file.name})${
            stampAt ? '; Section 1 marked complete from legacy e-sign date' : ''
          }`,
          createdBy: 'system:legacy-i9-backfill',
        },
      }),
    ])
  }

  console.log(
    `\n${apply ? 'Filed' : 'Would file'} ${filed} file(s) for ${new Set(
      files.filter((f) => profileById.has(f.name.split('/')[1])).map((f) => f.name.split('/')[1])
    ).size} staff; ${skipped} already filed; ${stamped.size} Section 1 date(s) ${apply ? 'stamped' : 'to stamp'}.`
  )
  if (orphans.length > 0) {
    console.log(`\nOrphan files (no matching staff profile — left in storage, not filed): ${orphans.length}`)
    for (const name of orphans) console.log(`  ${name}`)
  }
  if (!apply) console.log('\nDry run. Re-run with --apply to write.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
