import { PrismaClient } from '@prisma/client'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

const PDF_FOLDER = join(process.cwd(), 'onboarding-documents')

const PDF_MAP = [
  { slug: 'esignature-consent', file: 'RiseShine_12_ESignatureConsent_v1.docx.pdf' },
  { slug: 'welcome-letter', file: 'RiseShine_01_WelcomeLetter_v2.docx.pdf' },
  { slug: 'sexual-harassment-policy', file: 'RiseShine_SexualHarassmentPolicy_v1.pdf' },
  { slug: 'session-note-policy', file: 'RiseShine_06_SessionNotePolicy_v1.docx.pdf' },
  { slug: 'time-recording-policy', file: 'RiseShine_07_TimeRecordingPolicy_v1.docx.pdf' },
  { slug: 'doc-time-acknowledgment', file: 'RiseShine_08_DocAndTimeAcknowledgment_v1.docx.pdf' },
  { slug: 'sexual-harassment-acknowledgment', file: 'RiseShine_09_SexualHarassmentAcknowledgment_v1.docx.pdf' },
  { slug: 'fcra-disclosure', file: 'RiseShine_13_FCRA_Disclosure_v1.docx.pdf' },
  { slug: 'cfpb-consumer-rights', file: '201504_cfpb_summary_your-rights-under-fcra.pdf' },
  { slug: 'db271s', file: 'db271s.pdf' },
  { slug: 'pfl271s', file: 'PFL271S.pdf' },
  { slug: 'paid-sick-leave-notice', file: 'PaidSafeSickLeave-MandatoryNotice-English.pdf' },
  {
    slug: 'breast-milk-rights-notice',
    file: 'p705-policy-on-the-rights-of-employees-to-express-breast-milk-in-the-workplace_-24-1.pdf',
  },
  { slug: 'oig-self-attestation', file: 'RiseShine_10_OIG_SAM_OMIG_SelfAttestation_v1.docx.pdf' },
]

async function load(dryRun: boolean) {
  console.log(dryRun ? '=== DRY RUN (no writes) ===' : '=== LIVE LOAD ===')
  console.log(`PDF folder: ${PDF_FOLDER}\n`)

  let updated = 0
  let skipped = 0
  let failed = 0

  for (const { slug, file } of PDF_MAP) {
    const row = await prisma.onboardingDocument.findUnique({
      where: { slug },
      select: { slug: true, title: true, pdfData: true },
    })

    if (!row) {
      console.log(`FAIL: ${slug} — document row not found`)
      failed++
      continue
    }

    if (row.pdfData) {
      console.log(`SKIP (already has pdfData): ${slug}`)
      skipped++
      continue
    }

    const filePath = join(PDF_FOLDER, file)
    if (!existsSync(filePath)) {
      console.log(`FAIL: ${slug} — file not found: ${file}`)
      failed++
      continue
    }

    const base64 = (await readFile(filePath)).toString('base64')
    const sizeKb = Math.round(base64.length / 1024)

    if (dryRun) {
      console.log(`WOULD UPDATE: ${slug} ← ${file} (${sizeKb} KB base64)`)
      updated++
      continue
    }

    try {
      await prisma.onboardingDocument.update({
        where: { slug },
        data: { pdfData: base64 },
      })
      console.log(`OK: ${slug} ← ${file} (${sizeKb} KB base64)`)
      updated++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`FAIL: ${slug} — ${msg}`)
      failed++
    }
  }

  console.log(`\nSummary: ${dryRun ? 'wouldUpdate' : 'updated'}=${updated}, skipped=${skipped}, failed=${failed}`)
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  await load(dryRun)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
