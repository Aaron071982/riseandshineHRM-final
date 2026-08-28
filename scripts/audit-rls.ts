/**
 * Audit public tables for RLS status (advisor-equivalent).
 * Read-only. Dry-run against any target; refuses prod writes (this script
 * never writes). Pass --prod-confirm only if you intentionally point
 * DATABASE_URL at prod for a read-only audit.
 *
 *   dotenv -e .env.development -- tsx scripts/audit-rls.ts
 */
import { PrismaClient } from '@prisma/client'
import { assertWriteTarget } from '../lib/scripts/guard'

const prisma = new PrismaClient()

type RlsRow = {
  table_name: string
  rls_enabled: boolean
  policy_count: bigint
}

async function main() {
  assertWriteTarget({ allowProd: true })

  const rows = await prisma.$queryRaw<RlsRow[]>`
    SELECT
      c.relname AS table_name,
      c.relrowsecurity AS rls_enabled,
      (
        SELECT COUNT(*)::bigint
        FROM pg_policy p
        WHERE p.polrelid = c.oid
      ) AS policy_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
    ORDER BY c.relname
  `

  const gaps = rows.filter((r) => !r.rls_enabled)
  const noPolicies = rows.filter((r) => r.rls_enabled && Number(r.policy_count) === 0)

  console.log('═══ Public table RLS audit ═══')
  console.log(`  Tables: ${rows.length}`)
  console.log(`  RLS enabled: ${rows.filter((r) => r.rls_enabled).length}`)
  console.log(`  RLS disabled (gaps): ${gaps.length}`)
  console.log(`  RLS on, 0 policies: ${noPolicies.length}`)
  console.log('')
  console.log('table\t\t\trls\tpolicies')
  for (const r of rows) {
    const flag = r.rls_enabled ? 'on' : 'OFF'
    console.log(`${r.table_name.padEnd(40)} ${flag.padEnd(4)} ${r.policy_count}`)
  }

  if (gaps.length > 0) {
    console.log('\nGaps (RLS disabled):')
    for (const g of gaps) console.log(`  - ${g.table_name}`)
    process.exitCode = 2
  } else {
    console.log('\n✓ No public tables with RLS disabled')
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (supabaseUrl && anonKey) {
    const base = supabaseUrl.replace(/\/$/, '')
    const headers = {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    }

    async function checkAnon(table: string) {
      const res = await fetch(`${base}/rest/v1/${table}?select=id&limit=1`, {
        headers,
      })
      const body = await res.text()
      console.log(`\nAnon REST ${table}: HTTP ${res.status} body=${body.slice(0, 200)}`)
      if (res.ok) {
        try {
          const parsed = JSON.parse(body) as unknown[]
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.error(`✋ Anon key returned rows from ${table}`)
            process.exitCode = 3
            return
          }
        } catch {
          // blocked or non-json
        }
      }
      if (res.status === 401 || res.status === 403) {
        console.log(`✓ Anon key denied on ${table} (expected)`)
      } else if (!res.ok) {
        console.log(`✓ Anon key blocked on ${table} (HTTP ${res.status})`)
      }
    }

    await checkAnon('user_crm_roles')
    await checkAnon('crm_training_videos')
    await checkAnon('saved_queries')
  } else {
    console.log('\n(Skipping anon REST check — NEXT_PUBLIC_SUPABASE_URL / anon key unset)')
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
