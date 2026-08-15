/**
 * Import Clients_Master CSV into service_clients (idempotent, dry-run by default).
 *
 * Dev:
 *   tsx scripts/scrub-clients-csv.ts
 *   dotenv -e .env.development -- tsx scripts/import-clients.ts scripts/.tmp/clients_scrubbed.csv
 *   dotenv -e .env.development -- tsx scripts/import-clients.ts scripts/.tmp/clients_scrubbed.csv --confirm
 *
 * Prod (go-live, once):
 *   dotenv -e .env.production -- tsx scripts/import-clients.ts <real.csv>          # dry run
 *   dotenv -e .env.production -- tsx scripts/import-clients.ts <real.csv> --confirm --allow-prod
 *
 * Flags:
 *   --confirm     write (default is dry run)
 *   --force       overwrite non-null fields on update (default: fill-nulls only)
 *   --allow-prod  required when DATABASE_URL is not the DEV_SUPABASE_REF project
 */
import fs from 'fs'
import path from 'path'
import { PrismaClient, type ClientStage, type ClientPipelineStatus, type RequirementStatus, type ServiceClientStatus } from '@prisma/client'
import { STAGE_DEFAULT_OWNER_DEPT, REQUIREMENT_KEY_LABELS } from '../lib/crm/stages'
import { parseCsv, toCsv } from './lib/csv'

const prisma = new PrismaClient()

const DOC_COLUMNS: { csv: string; key: string }[] = [
  { csv: 'Insurance Card', key: 'insurance_card' },
  { csv: 'Medicaid Card', key: 'medicaid_card' },
  { csv: 'Diagnostic Eval', key: 'diagnostic_eval' },
  { csv: 'Physician Referral', key: 'physician_referral' },
  { csv: 'IEP/IFSP', key: 'iep_ifsp' },
  { csv: 'Custody/Guardian', key: 'custody_guardian' },
  { csv: 'Prior ABA Records', key: 'prior_aba_records' },
]

const BOROUGHS = [
  'Bronx',
  'Brooklyn',
  'Queens',
  'Manhattan',
  'Staten Island',
] as const

type UnmatchedRow = {
  clientCode: string
  field: string
  rawValue: string
  candidates: string
}

type NameCandidate = { id: string; label: string }

type PlanLine = {
  clientCode: string
  action: 'INSERT' | 'UPDATE' | 'SKIP'
  stage: ClientStage
  pipelineStatus: ClientPipelineStatus
  name: string
  notes: string[]
}

function argFlag(name: string): boolean {
  return process.argv.includes(name)
}

function csvPathArg(): string {
  const a = process.argv.slice(2).find((x) => !x.startsWith('--'))
  if (!a) {
    console.error('Usage: tsx scripts/import-clients.ts <csv> [--confirm] [--force] [--allow-prod]')
    process.exit(1)
  }
  return path.resolve(a)
}

function dbHost(url: string): string {
  return url.split('@')[1]?.split('/')[0] ?? 'unknown'
}

function isDevTarget(url: string): boolean {
  const ref = process.env.DEV_SUPABASE_REF?.trim()
  return !!ref && url.includes(ref)
}

function get(row: Record<string, string>, key: string): string {
  return (row[key] ?? '').trim()
}

function normalizeStatus(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

function mapStatus(raw: string): {
  stage: ClientStage
  pipelineStatus: ClientPipelineStatus
  legacyStatus: ServiceClientStatus
  note?: string
} {
  const s = normalizeStatus(raw).toLowerCase()
  if (s === 'active') {
    return { stage: 'ACTIVE', pipelineStatus: 'LIVE', legacyStatus: 'ACTIVE' }
  }
  if (s === 'new') {
    return { stage: 'INQUIRY', pipelineStatus: 'LIVE', legacyStatus: 'NEW' }
  }
  if (s === 'discharged') {
    return {
      stage: 'ACTIVE',
      pipelineStatus: 'DISCHARGED',
      legacyStatus: 'DISCHARGED',
    }
  }
  if (s === 'inactive') {
    return {
      stage: 'ACTIVE',
      pipelineStatus: 'ON_HOLD',
      legacyStatus: 'ON_HOLD',
    }
  }
  return {
    stage: 'INQUIRY',
    pipelineStatus: 'LIVE',
    legacyStatus: 'NEW',
    note: `Unknown/blank status ${JSON.stringify(raw)} → INQUIRY/LIVE`,
  }
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: 'Unknown', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0]!, lastName: '' }
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') }
}

function parseDob(raw: string): Date | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const month = Number(m[1])
  const day = Number(m[2])
  const year = Number(m[3])
  const d = new Date(Date.UTC(year, month - 1, day))
  return Number.isNaN(d.getTime()) ? null : d
}

function parseAddress(raw: string): {
  addressLine: string | null
  city: string | null
  borough: string | null
  state: string | null
  zip: string | null
} {
  const text = raw.trim()
  if (!text) {
    return { addressLine: null, city: null, borough: null, state: null, zip: null }
  }
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean)
  const addressLine = parts[0] || null
  let borough: string | null = null
  let city: string | null = null
  let state: string | null = null
  let zip: string | null = null

  for (const p of parts.slice(1)) {
    const b = BOROUGHS.find((x) => x.toLowerCase() === p.toLowerCase())
    if (b) {
      borough = b
      city = b
      continue
    }
    const stZip = p.match(/^([A-Za-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$/)
    if (stZip) {
      state = stZip[1]!.toUpperCase()
      zip = stZip[2] ?? null
      continue
    }
    if (/^\d{5}(?:-\d{4})?$/.test(p)) {
      zip = p
      continue
    }
    if (!city) city = p
  }
  if (!state && /,\s*NY\b/i.test(text)) state = 'NY'
  return { addressLine, city, borough, state, zip }
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return raw.trim() || null
}

function parseNumber(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function hoursFromCaseBlob(
  caseBlob: string,
  kind: 'current' | 'auth'
): number | null {
  const re =
    kind === 'current'
      ? /Current\s*Hrs\/wk:\s*([\d.]+)/i
      : /Auth\s*Hrs\/wk:\s*([\d.]+)/i
  const m = caseBlob.match(re)
  return m ? parseNumber(m[1]!) : null
}

function parsePersonnelFallback(personnel: string): {
  bcba: string | null
  bts: string[]
} {
  let bcba: string | null = null
  let bts: string[] = []
  const bcbaM = personnel.match(/BCBA:\s*([^\n]+)/i)
  if (bcbaM) {
    const v = bcbaM[1]!.trim()
    if (v && !/^n\/?a$/i.test(v)) bcba = v
  }
  const btM = personnel.match(/BTs?:\s*([^\n]+)/i)
  if (btM) {
    bts = splitBtList(btM[1]!)
  }
  return { bcba, bts }
}

function splitBtList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !/^n\/?a$/i.test(s))
}

function mapDocStatus(raw: string): RequirementStatus {
  const s = raw.trim().toLowerCase()
  if (s === 'yes' || s === 'y') return 'RECEIVED'
  if (s === 'no' || s === 'n') return 'MISSING'
  if (s === 'n/a' || s === 'na') return 'NOT_APPLICABLE'
  return 'PENDING'
}

function normName(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchName(
  raw: string,
  pool: NameCandidate[],
  unmatched: UnmatchedRow[],
  clientCode: string,
  field: string
): { id: string | null; label: string | null } {
  const label = raw.trim()
  if (!label || /^n\/?a$/i.test(label)) {
    return { id: null, label: null }
  }
  const needle = normName(label)
  const exact = pool.filter((c) => normName(c.label) === needle)
  if (exact.length === 1) return { id: exact[0]!.id, label }
  if (exact.length > 1) {
    unmatched.push({
      clientCode,
      field,
      rawValue: label,
      candidates: exact.map((c) => c.label).join(' | '),
    })
    return { id: null, label }
  }

  // First-name / prefix match (e.g. "Shazia" → "Shazia Khaliq")
  const tokens = needle.split(' ')
  const first = tokens[0]!
  const prefixHits = pool.filter((c) => {
    const n = normName(c.label)
    const parts = n.split(' ')
    return parts[0] === first || n.startsWith(needle + ' ') || n.startsWith(first + ' ')
  })
  // Prefer unique first-name match when query is a single token
  const firstOnly = pool.filter((c) => normName(c.label).split(' ')[0] === first)
  const candidates =
    tokens.length === 1
      ? firstOnly.length === 1
        ? firstOnly
        : firstOnly.length > 1
          ? firstOnly
          : prefixHits
      : prefixHits.filter((c) => normName(c.label).startsWith(needle))

  if (candidates.length === 1) return { id: candidates[0]!.id, label }
  unmatched.push({
    clientCode,
    field,
    rawValue: label,
    candidates:
      candidates.length > 0
        ? candidates.map((c) => c.label).join(' | ')
        : '(none)',
  })
  return { id: null, label }
}

function isEmptyValue(v: unknown): boolean {
  if (v == null) return true
  if (typeof v === 'string') return v.trim() === ''
  return false
}

/** Fill-nulls merge: only copy keys where existing is null/empty unless force. */
function mergeFillNulls<T extends Record<string, unknown>>(
  existing: T,
  incoming: Partial<T>,
  force: boolean
): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined) continue
    const cur = existing[k as keyof T]
    if (force || isEmptyValue(cur)) {
      ;(out as Record<string, unknown>)[k] = v
    }
  }
  return out
}

async function resolveSystemActorId(): Promise<string | null> {
  const emails = (
    process.env.CLIENT_SERVICES_FULL_ACCESS_EMAILS ||
    process.env.ADMIN_FALLBACK_EMAIL ||
    ''
  )
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        ...(emails.length
          ? [{ email: { in: emails, mode: 'insensitive' as const } }]
          : []),
        { role: { in: ['ADMIN', 'DEV'] } },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  return user?.id ?? null
}

async function main() {
  const filePath = csvPathArg()
  const confirm = argFlag('--confirm')
  const force = argFlag('--force')
  const allowProd = argFlag('--allow-prod')

  if (!fs.existsSync(filePath)) {
    console.error(`✋ CSV not found: ${filePath}`)
    process.exit(1)
  }

  const dbUrl = process.env.DATABASE_URL ?? ''
  if (!dbUrl) {
    console.error('✋ DATABASE_URL is unset')
    process.exit(1)
  }
  const host = dbHost(dbUrl)
  const onDev = isDevTarget(dbUrl)

  console.log('═══ Client CSV import ═══')
  console.log(`  CSV:     ${filePath}`)
  console.log(`  Target:  ${host}`)
  console.log(`  Mode:    ${confirm ? 'WRITE' : 'DRY RUN (no writes)'}`)
  console.log(`  Merge:   ${force ? 'FORCE overwrite' : 'fill-nulls only'}`)
  console.log(`  Project: ${onDev ? 'DEV (ref match)' : 'NON-DEV'}`)

  const [clientCount, reqCount, btCount] = await Promise.all([
    prisma.serviceClient.count(),
    prisma.clientRequirement.count(),
    prisma.serviceClientBtAssignment.count(),
  ])
  console.log(
    `  Counts:  service_clients=${clientCount}  requirements=${reqCount}  bt_assignments=${btCount}`
  )

  if (confirm && !onDev && !allowProd) {
    console.error(
      '✋ Refusing to write to a non-dev database without --allow-prod'
    )
    process.exit(1)
  }

  const buf = fs.readFileSync(filePath)
  // Scrubbed output is utf8; real master is latin1 — try utf8 first, fall back.
  let text: string
  try {
    text = buf.toString('utf8')
    // If replacement chars dominate, use latin1
    if ((text.match(/\uFFFD/g) || []).length > 5) {
      text = buf.toString('latin1')
    }
  } catch {
    text = buf.toString('latin1')
  }

  const { headers, rows: rawRows } = parseCsv(text)
  const dictRows: Record<string, string>[] = []
  for (const cells of rawRows) {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = cells[i] ?? ''
    })
    if (!get(obj, 'Client ID')) continue
    dictRows.push(obj)
  }

  console.log(`  Clients in CSV (non-empty Client ID): ${dictRows.length}`)

  const [bcbas, rbts, users] = await Promise.all([
    prisma.bCBAProfile.findMany({ select: { id: true, fullName: true } }),
    prisma.rBTProfile.findMany({
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
    }),
  ])

  const bcbaPool: NameCandidate[] = bcbas.map((b) => ({
    id: b.id,
    label: b.fullName,
  }))
  const rbtPool: NameCandidate[] = rbts.map((r) => ({
    id: r.id,
    label: `${r.firstName} ${r.lastName}`.trim(),
  }))
  const userPool: NameCandidate[] = users
    .filter((u) => u.name || u.email)
    .map((u) => ({
      id: u.id,
      label: u.name?.trim() || u.email || u.id,
    }))

  const unmatched: UnmatchedRow[] = []
  const plan: PlanLine[] = []
  const actorId = confirm ? await resolveSystemActorId() : null

  let inserted = 0
  let updated = 0
  let reqCreated = 0
  let btCreated = 0

  for (const row of dictRows) {
    const clientCode = get(row, 'Client ID').toUpperCase()
    const notes: string[] = []
    let clientName = get(row, 'Client Name')
    let bcbaRaw = get(row, 'BCBA')
    let btsRaw = get(row, 'Assigned BTs')
    const coordinatorRaw = get(row, 'Case Coordinator')
    const personnel = get(row, 'Personnel')
    const caseBlob = get(row, 'Case')

    if ((!bcbaRaw || !btsRaw) && personnel) {
      const fb = parsePersonnelFallback(personnel)
      if (!bcbaRaw && fb.bcba) {
        bcbaRaw = fb.bcba
        notes.push('BCBA from Personnel blob')
      }
      if (!btsRaw && fb.bts.length) {
        btsRaw = fb.bts.join(', ')
        notes.push('BTs from Personnel blob')
      }
    }

    const statusMap = mapStatus(get(row, 'Status'))
    if (statusMap.note) notes.push(statusMap.note)

    const { firstName, lastName } = splitName(clientName || 'Unknown')
    const dob = parseDob(get(row, 'DOB'))
    const addr = parseAddress(get(row, 'Address'))

    let currentHours =
      parseNumber(get(row, 'Current Hours')) ??
      hoursFromCaseBlob(caseBlob, 'current')
    let authHours =
      parseNumber(get(row, 'Auth Hours')) ??
      hoursFromCaseBlob(caseBlob, 'auth')

    const authLengthMonths = (() => {
      const n = parseNumber(get(row, 'Auth Length (Months)'))
      return n == null ? null : Math.round(n)
    })()

    const serviceStartDate = parseDob(get(row, 'Service Start Date'))
    const serviceEndDate = parseDob(get(row, 'Service End Date'))

    const bcbaMatch = matchName(
      bcbaRaw,
      bcbaPool,
      unmatched,
      clientCode,
      'BCBA'
    )
    const ccMatch = matchName(
      coordinatorRaw,
      userPool,
      unmatched,
      clientCode,
      'Case Coordinator'
    )

    const btNames = splitBtList(btsRaw)
    const btMatches = btNames.map((name) => ({
      name,
      match: matchName(name, rbtPool, unmatched, clientCode, 'Assigned BTs'),
    }))

    const existing = await prisma.serviceClient.findUnique({
      where: { clientCode },
      include: {
        btAssignments: true,
        requirements: { select: { key: true, status: true } },
      },
    })

    const now = new Date()
    const incomingCore = {
      firstName,
      lastName,
      status: statusMap.legacyStatus,
      stage: statusMap.stage,
      pipelineStatus: statusMap.pipelineStatus,
      stageEnteredAt: now,
      currentOwnerDept: STAGE_DEFAULT_OWNER_DEPT[statusMap.stage],
      referralSource: 'OTHER' as const,
      dateOfBirth: dob,
      addressLine: addr.addressLine,
      city: addr.city,
      borough: addr.borough,
      state: addr.state,
      zip: addr.zip,
      insuranceProvider: get(row, 'Insurance') || null,
      parentName: get(row, 'Parent Name') || null,
      parentPhone: normalizePhone(get(row, 'Parent Number')),
      parentEmail: get(row, 'Parent Email') || null,
      bcbaName: bcbaMatch.label,
      bcbaProfileId: bcbaMatch.id,
      caseCoordinatorName: ccMatch.label,
      caseCoordinatorUserId: ccMatch.id,
      currentHoursPerWeek: currentHours,
      authHours,
      authLengthMonths,
      serviceStartDate,
      serviceEndDate,
    }

    const action: PlanLine['action'] = existing ? 'UPDATE' : 'INSERT'
    plan.push({
      clientCode,
      action,
      stage: statusMap.stage,
      pipelineStatus: statusMap.pipelineStatus,
      name: `${firstName} ${lastName}`.trim(),
      notes: [
        ...notes,
        bcbaMatch.id
          ? `BCBA→${bcbaMatch.label}`
          : bcbaMatch.label
            ? `BCBA unmatched (${bcbaMatch.label})`
            : 'no BCBA',
        `BTs: ${btMatches.length}`,
        `docs: ${DOC_COLUMNS.length}`,
      ],
    })

    if (!confirm) continue

    let clientId: string
    if (!existing) {
      const created = await prisma.serviceClient.create({
        data: {
          clientCode,
          ...incomingCore,
          createdBy: actorId,
        },
      })
      clientId = created.id
      inserted++
    } else {
      // On update: fill-nulls for demographics; do NOT reset stage/pipeline
      // unless those fields are empty (they shouldn't be) — preserve human edits.
      const fill = mergeFillNulls(
        existing as unknown as Record<string, unknown>,
        {
          firstName: incomingCore.firstName,
          lastName: incomingCore.lastName,
          dateOfBirth: incomingCore.dateOfBirth,
          addressLine: incomingCore.addressLine,
          city: incomingCore.city,
          borough: incomingCore.borough,
          state: incomingCore.state,
          zip: incomingCore.zip,
          insuranceProvider: incomingCore.insuranceProvider,
          parentName: incomingCore.parentName,
          parentPhone: incomingCore.parentPhone,
          parentEmail: incomingCore.parentEmail,
          bcbaName: incomingCore.bcbaName,
          bcbaProfileId: incomingCore.bcbaProfileId,
          caseCoordinatorName: incomingCore.caseCoordinatorName,
          caseCoordinatorUserId: incomingCore.caseCoordinatorUserId,
          currentHoursPerWeek: incomingCore.currentHoursPerWeek,
          authHours: incomingCore.authHours,
          authLengthMonths: incomingCore.authLengthMonths,
          serviceStartDate: incomingCore.serviceStartDate,
          serviceEndDate: incomingCore.serviceEndDate,
          // Only set stage/pipeline/status if somehow missing (shouldn't be)
          ...(force
            ? {
                stage: incomingCore.stage,
                pipelineStatus: incomingCore.pipelineStatus,
                status: incomingCore.status,
                currentOwnerDept: incomingCore.currentOwnerDept,
                stageEnteredAt: incomingCore.stageEnteredAt,
              }
            : {}),
        } as Record<string, unknown>,
        force
      )

      if (Object.keys(fill).length > 0) {
        await prisma.serviceClient.update({
          where: { id: existing.id },
          data: fill,
        })
      }
      clientId = existing.id
      updated++
    }

    // Requirements — create-if-absent, never reset status
    const liveReqs = new Set(
      (
        await prisma.clientRequirement.findMany({
          where: { serviceClientId: clientId },
          select: { key: true },
        })
      ).map((r) => r.key)
    )

    for (const doc of DOC_COLUMNS) {
      if (liveReqs.has(doc.key)) continue
      const status = mapDocStatus(get(row, doc.csv))
      await prisma.clientRequirement.create({
        data: {
          serviceClientId: clientId,
          stage: 'DOCUMENTS',
          key: doc.key,
          label: REQUIREMENT_KEY_LABELS[doc.key] ?? doc.csv,
          type: 'DOCUMENT',
          status,
          isRequiredToAdvance: true,
        },
      })
      liveReqs.add(doc.key)
      reqCreated++
    }

    // BT assignments — create if pair missing; never delete
    for (let i = 0; i < btMatches.length; i++) {
      const bt = btMatches[i]!
      const rbtProfileId = bt.match.id
      const btName = bt.match.label || bt.name

      const dup = await prisma.serviceClientBtAssignment.findFirst({
        where: {
          serviceClientId: clientId,
          OR: [
            ...(rbtProfileId ? [{ rbtProfileId }] : []),
            { btName: { equals: btName, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      })
      if (dup) continue

      await prisma.serviceClientBtAssignment.create({
        data: {
          serviceClientId: clientId,
          btName,
          rbtProfileId,
          isPrimary: i === 0,
          status: 'ACTIVE',
          assignmentStage: 'ASSIGNED',
        },
      })
      btCreated++
    }

    if (actorId) {
      await prisma.clientAccessLog.create({
        data: {
          userId: actorId,
          serviceClientId: clientId,
          action: 'IMPORT',
        },
      })
    }
  }

  // Plan printout
  console.log('\n── Plan ──')
  for (const p of plan) {
    console.log(
      `  ${p.action.padEnd(6)} ${p.clientCode}  ${p.name}  [${p.stage}/${p.pipelineStatus}]  ${p.notes.join('; ')}`
    )
  }

  const outDir = path.join(process.cwd(), 'scripts', '.tmp')
  fs.mkdirSync(outDir, { recursive: true })
  const unmatchedPath = path.join(outDir, 'import-unmatched.csv')
  fs.writeFileSync(
    unmatchedPath,
    toCsv(
      ['clientCode', 'field', 'rawValue', 'candidates'],
      unmatched.map((u) => [u.clientCode, u.field, u.rawValue, u.candidates])
    ),
    'utf8'
  )

  console.log(`\n── Unmatched names: ${unmatched.length} ──`)
  console.log(`  Report: ${unmatchedPath}`)
  if (unmatched.length) {
    for (const u of unmatched.slice(0, 30)) {
      console.log(
        `  ${u.clientCode}  ${u.field}: "${u.rawValue}" → ${u.candidates}`
      )
    }
    if (unmatched.length > 30) {
      console.log(`  … +${unmatched.length - 30} more (see CSV)`)
    }
  }

  if (!confirm) {
    console.log(
      '\nDry run complete — no writes. Re-run with --confirm to apply.'
    )
  } else {
    console.log('\n── Write summary ──')
    console.log(`  inserted clients: ${inserted}`)
    console.log(`  updated clients:  ${updated}`)
    console.log(`  requirements created: ${reqCreated}`)
    console.log(`  BT assignments created: ${btCreated}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
