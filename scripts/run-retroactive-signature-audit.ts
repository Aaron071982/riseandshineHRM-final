/**
 * Runs the same retroactive certificate backfill as the admin API (no cookie required).
 *
 * Usage:
 *   npx tsx scripts/run-retroactive-signature-audit.ts           # apply changes
 *   npx tsx scripts/run-retroactive-signature-audit.ts --dry-run # count only, no inserts
 *   DRY_RUN=1 npx tsx scripts/run-retroactive-signature-audit.ts
 */
import { runRetroactiveSignatureAudit } from '../lib/retroactive-signature-audit'

async function main() {
  const dryRun =
    process.argv.includes('--dry-run') ||
    process.argv.includes('-n') ||
    process.env.DRY_RUN === '1' ||
    process.env.DRY_RUN === 'true'

  const result = await runRetroactiveSignatureAudit({ dryRun })
  console.log(JSON.stringify(result, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
