/**
 * Backfill catalog UPLOAD completions (SSC, CPR, certificates) into rbt_documents
 * so they appear on the admin Documents tab / RBT Document Center.
 *
 * Usage:
 *   npx tsx scripts/backfill-onboarding-upload-documents.ts
 *   npx tsx scripts/backfill-onboarding-upload-documents.ts --dry-run
 */
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import { STORAGE_BUCKET } from '../lib/constants'
import {
  ONBOARDING_UPLOAD_SLUG_TO_DOC_TYPE,
  mimeTypeFromFileName,
  replaceRbtDocumentOfType,
} from '../lib/rbtDocumentsSync'

const dryRun = process.argv.includes('--dry-run')

const prisma = new PrismaClient()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

async function main() {
  const slugs = Object.keys(ONBOARDING_UPLOAD_SLUG_TO_DOC_TYPE)
  console.log(
    dryRun
      ? 'Dry run: scanning completed catalog uploads missing from rbt_documents…'
      : 'Backfilling catalog uploads into rbt_documents…'
  )

  if (!dryRun && (!supabaseUrl || !supabaseServiceRoleKey)) {
    throw new Error('Supabase env vars required (NEXT_PUBLIC_SUPABASE_URL + service role key)')
  }

  const supabaseAdmin =
    supabaseUrl && supabaseServiceRoleKey
      ? createClient(supabaseUrl, supabaseServiceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null

  const completions = await prisma.onboardingCompletion.findMany({
    where: {
      status: 'COMPLETED',
      signedPdfUrl: { not: null },
      document: { slug: { in: slugs } },
    },
    include: {
      document: { select: { slug: true, title: true } },
      rbtProfile: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { completedAt: 'asc' },
  })

  console.log(`Found ${completions.length} completed upload completion(s)`)

  let synced = 0
  let skipped = 0
  let failed = 0

  for (const c of completions) {
    const slug = c.document.slug
    const docType = ONBOARDING_UPLOAD_SLUG_TO_DOC_TYPE[slug]
    if (!docType) {
      skipped++
      continue
    }

    const existing = await prisma.rBTDocument.findFirst({
      where: { rbtProfileId: c.rbtProfileId, documentType: docType },
      select: { id: true },
    })
    if (existing) {
      console.log(
        `⏭️  ${c.rbtProfile.firstName} ${c.rbtProfile.lastName}: ${docType} already present — skip`
      )
      skipped++
      continue
    }

    const storagePath = c.signedPdfUrl!.trim()
    if (!storagePath) {
      skipped++
      continue
    }

    const name = `${c.rbtProfile.firstName} ${c.rbtProfile.lastName}`
    if (dryRun) {
      console.log(`Would sync ${docType} for ${name} from ${storagePath}`)
      synced++
      continue
    }

    try {
      const bucket = c.storageBucket?.trim() || STORAGE_BUCKET
      const { data, error } = await supabaseAdmin!.storage.from(bucket).download(storagePath)
      if (error || !data) {
        console.error(`❌ ${name}: download failed for ${storagePath}`, error)
        failed++
        continue
      }
      const buffer = Buffer.from(await data.arrayBuffer())
      const pathBase = storagePath.split('/').pop() || `${slug}.bin`
      const fileName = pathBase
      await replaceRbtDocumentOfType(prisma, {
        rbtProfileId: c.rbtProfileId,
        documentType: docType,
        fileName,
        fileType: mimeTypeFromFileName(fileName),
        fileBase64: buffer.toString('base64'),
      })
      console.log(`✅ Synced ${docType} for ${name}`)
      synced++
    } catch (e) {
      console.error(`❌ ${name}:`, e)
      failed++
    }
  }

  console.log(`Done. synced=${synced} skipped=${skipped} failed=${failed}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
