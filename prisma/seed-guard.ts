/**
 * Safety guard for any script that mutates the database.
 * Aborts unless DATABASE_URL contains the PHI-safe DEV Supabase project ref.
 */
export function assertDevTarget() {
  const url = process.env.DATABASE_URL ?? ''
  const devRef = process.env.DEV_SUPABASE_REF ?? ''
  const host = url.split('@')[1]?.split('/')[0] ?? 'unknown'
  if (!devRef || !url.includes(devRef)) {
    console.error(
      `✋ Refusing to run — target is not the dev project.\n   Target host: ${host}\n   Expected ref: ${devRef || '(DEV_SUPABASE_REF unset)'}`
    )
    process.exit(1)
  }
  console.log(`✓ Dev target confirmed: ${host}`)
}
