import type { Session, PayerType, IngestResult, Rates } from './types'

export const CPT_META: Record<string, { label: string; provider: string }> = {
  '97151': { label: 'Assessment', provider: 'BCBA' },
  '97152': { label: 'Supporting assessment', provider: 'RBT' },
  '97153': { label: 'Direct therapy', provider: 'RBT' },
  '97154': { label: 'Group therapy', provider: 'RBT' },
  '97155': { label: 'Supervision', provider: 'BCBA' },
  '97156': { label: 'Family guidance', provider: 'BCBA' },
}

// Reference rate card ($/unit). NY Medicaid = schedule effective Apr 1 2026.
export const DEFAULT_RATES: Rates = {
  Medicaid: {
    '97151': 19.26,
    '97152': 19.26,
    '97153': 14.45,
    '97154': 3.31,
    '97155': 19.26,
    '97156': 19.26,
  },
  Commercial: {
    '97151': 24.37,
    '97152': 18.08,
    '97153': 18.04,
    '97154': 18.08,
    '97155': 24.37,
    '97156': 24.37,
  },
  Tricare: {
    '97151': 34.0,
    '97152': 24.0,
    '97153': 21.0,
    '97154': 10.0,
    '97155': 33.0,
    '97156': 30.0,
  },
}

export const S_DELIVERED = new Set(['In Progress', 'Incomplete', 'Completed', 'Ready to Bill'])
export const S_DOCUMENTED = new Set(['Completed', 'Ready to Bill'])

const nrm = (h: unknown) =>
  String(h ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
const num = (v: unknown) => {
  const n = parseFloat(String(v))
  return isNaN(n) ? 0 : n
}

export function inferPayerType(payer: string): PayerType {
  const p = String(payer || '').toLowerCase()
  if (p.includes('medicaid') || p.includes('medicare')) return 'Medicaid'
  if (p.includes('tricare')) return 'Tricare'
  return 'Commercial'
}

function parseDate(v: unknown): Date | null {
  if (!v) return null
  const s = String(v).split(',')[0].trim()
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return new Date(+m[3], +m[1] - 1, +m[2])
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '')

function weekOf(d: Date | null): string {
  if (!d) return ''
  const x = new Date(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return iso(x)
}

/** Locate the Artemis header row inside the preamble. */
export function findArtemisHeader(aoa: unknown[][]): number {
  for (let i = 0; i < Math.min(aoa.length, 40); i++) {
    const set = new Set((aoa[i] || []).map(nrm))
    if (set.has('casenumber') && (set.has('practiceprocedurecode') || set.has('actualunit')))
      return i
  }
  return -1
}

export function parseArtemis(aoa: unknown[][], headerIdx: number): Session[] {
  const header = aoa[headerIdx]
  const col: Record<string, number> = {}
  header.forEach((h, j) => {
    col[nrm(h)] = j
  })
  const find = (...keys: string[]) => {
    for (const k of keys) if (col[k] != null) return col[k]
    return null
  }
  const c = {
    status: find('status'),
    claimStatus: find('caseclaimstatus'),
    caseNo: find('casenumber'),
    client: find('client'),
    clientId: find('clientid'),
    provider: find('providername', 'provider'),
    role: find('caseproviderrole'),
    payer: find('insurance'),
    cpt: find('practiceprocedurecode', 'procedurecode'),
    dos: find('dos'),
    unit: find('unit'),
    actualUnit: find('actualunit'),
    charge: find('billedamount'),
    allowed: find('practicefee'),
    claim: find('claim'),
    paid: find('caseclaimclaimtotalpaidamount'),
  }
  const body = aoa
    .slice(headerIdx + 1)
    .filter((r) => c.caseNo != null && String(r[c.caseNo] ?? '').trim() !== '')

  // forward-fill grouped Status / Claim Status
  let lastS = '',
    lastCS = ''
  body.forEach((r) => {
    if (c.status != null) {
      if (String(r[c.status] ?? '').trim()) lastS = String(r[c.status]).trim()
      else r[c.status] = lastS
    }
    if (c.claimStatus != null) {
      if (String(r[c.claimStatus] ?? '').trim()) lastCS = String(r[c.claimStatus]).trim()
      else r[c.claimStatus] = lastCS
    }
  })

  const seen = new Set<string>()
  return body.map((r, i) => {
    const claimNo = c.claim != null ? String(r[c.claim] ?? '').trim() : ''
    let paidAlloc = 0
    if (claimNo && !seen.has(claimNo)) {
      paidAlloc = c.paid != null ? num(r[c.paid]) : 0
      seen.add(claimNo)
    }
    const d = parseDate(c.dos != null ? r[c.dos] : null)
    const payer = (c.payer != null ? String(r[c.payer] ?? '').trim() : '') || 'Unknown'
    const uSched = c.unit != null ? num(r[c.unit]) : 0
    const uRend = (c.actualUnit != null ? num(r[c.actualUnit]) : 0) || uSched
    const allowed = c.allowed != null ? num(r[c.allowed]) : 0
    const cpt = String(c.cpt != null ? (r[c.cpt] ?? '') : '').match(/\d{5}/)?.[0] || '—'
    const claimStatus = c.claimStatus != null ? String(r[c.claimStatus] ?? '').trim() : ''
    return {
      id: 'S' + i,
      date: iso(d),
      week: weekOf(d),
      client: String(c.client != null ? (r[c.client] ?? '—') : '—').trim(),
      clientId: String(c.clientId != null ? (r[c.clientId] ?? '') : '').trim(),
      payer,
      payerType: inferPayerType(payer),
      cpt,
      provider: String(c.provider != null ? (r[c.provider] ?? '—') : '—').trim(),
      providerRole:
        c.role != null ? String(r[c.role] ?? '').trim() : CPT_META[cpt]?.provider || '',
      sessionStatus: String(c.status != null ? (r[c.status] ?? '') : '').trim() || 'Unknown',
      claimNo,
      claimStatus: claimNo ? claimStatus : '',
      unitsScheduled: uSched,
      unitsRendered: uRend,
      charge: c.charge != null ? num(r[c.charge]) : 0,
      allowed,
      rateFromFile: allowed > 0 && uRend > 0 ? allowed / uRend : null,
      paidAlloc,
    }
  })
}

/* ---- Generic fallback for non-Artemis files (priced off the rate card) ---- */
const SYNS: Record<string, string[]> = {
  date: ['date', 'sessiondate', 'servicedate', 'dos', 'dateofservice'],
  client: ['client', 'clientname', 'patient', 'member'],
  payer: ['payer', 'insurance', 'plan', 'carrier'],
  cpt: ['cpt', 'cptcode', 'code', 'procedurecode', 'practiceprocedurecode'],
  provider: ['provider', 'therapist', 'rendering', 'providername'],
  status: ['status', 'sessionstatus', 'appointmentstatus'],
  unitsScheduled: ['unitscheduled', 'unit', 'scheduledunits'],
  unitsRendered: ['units', 'actualunit', 'unitsrendered', 'billableunits', 'deliveredunits'],
  claimStatus: ['claimstatus', 'billingstatus'],
  paidAmount: ['paid', 'paidamount', 'payment', 'collected'],
}

export function autoMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  const normed = headers.map((h) => ({ raw: h, n: nrm(h) }))
  for (const f of Object.keys(SYNS)) {
    const hit =
      normed.find((h) => SYNS[f].includes(h.n)) ||
      normed.find((h) => SYNS[f].some((s) => h.n.includes(s) && s.length > 3))
    if (hit) map[f] = hit.raw
  }
  return map
}

export function mappedToSessions(
  rows: Record<string, unknown>[],
  map: Record<string, string>,
  rates: Rates
): Session[] {
  const out: Session[] = []
  rows.forEach((r, i) => {
    const g = (f: string) => (map[f] ? r[map[f]] : undefined)
    const d = parseDate(g('date'))
    const cpt = String(g('cpt') ?? '').match(/\d{5}/)?.[0] || '—'
    if (!d && cpt === '—') return
    const payer = String(g('payer') ?? 'Unknown').trim()
    const payerType = inferPayerType(payer)
    const uRend = num(g('unitsRendered'))
    const uSched = num(g('unitsScheduled')) || uRend
    let st = String(g('status') ?? 'Ready to Bill').trim()
    if (/cancel/i.test(st)) st = 'Cancelled'
    else if (/no.?show|delete/i.test(st)) st = 'Deleted'
    else if (/complete/i.test(st)) st = 'Ready to Bill'
    const cs = String(g('claimStatus') ?? '').trim()
    const rate = rates[payerType]?.[cpt] ?? 0
    const paid = num(g('paidAmount'))
    out.push({
      id: 'S' + i,
      date: iso(d),
      week: weekOf(d),
      client: String(g('client') ?? '—').trim(),
      clientId: '',
      payer,
      payerType,
      cpt,
      provider: String(g('provider') ?? '—').trim(),
      providerRole: CPT_META[cpt]?.provider || '',
      sessionStatus: st,
      claimNo: cs ? 'CL' + i : '',
      claimStatus: cs,
      unitsScheduled: uSched,
      unitsRendered: uRend,
      charge: uRend * rate,
      allowed: uRend * rate,
      rateFromFile: null,
      paidAlloc: paid || (/paid/i.test(cs) ? uRend * rate : 0),
    })
  })
  return out
}

/** One entry point: detect Artemis vs generic and return canonical sessions. */
export function ingest(aoa: unknown[][], rates: Rates): IngestResult {
  const hi = findArtemisHeader(aoa)
  if (hi >= 0)
    return {
      sessions: parseArtemis(aoa, hi),
      hasRealMoney: true,
      source: 'Artemis Session Reconciliation',
    }
  const hIdx = aoa.findIndex((r) => (r || []).filter((cell) => cell !== '' && cell != null).length >= 3)
  if (hIdx < 0) return { sessions: [], hasRealMoney: false, source: 'Unrecognized file' }
  const flds = aoa[hIdx].map((h) => String(h ?? '').trim())
  const objs = aoa.slice(hIdx + 1).map((r) => {
    const o: Record<string, unknown> = {}
    flds.forEach((f, j) => {
      o[f] = r[j]
    })
    return o
  })
  return {
    sessions: mappedToSessions(objs, autoMap(flds), rates),
    hasRealMoney: false,
    source: 'Uploaded file',
  }
}
