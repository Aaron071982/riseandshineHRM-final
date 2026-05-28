/**
 * Seeds the canonical 32-step onboarding document catalog.
 * Run: npx tsx scripts/seed-onboarding-documents.ts
 */
import { seedOnboardingCatalog } from '@/lib/onboarding/provision'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) {
    console.log('Dry run — use lib/onboarding/catalog.ts; run without --dry-run to upsert.')
    return
  }
  const { upserted, missingFiles } = await seedOnboardingCatalog()
  console.log(`Upserted ${upserted} catalog documents.`)
  if (missingFiles.length) {
    console.warn('Missing PDF files:', missingFiles.join(', '))
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
