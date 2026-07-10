import _ from 'lodash'
import type { Session, Rates } from './types'
import { CPT_META, S_DELIVERED, S_DOCUMENTED } from './parse'

export const UNITS_PER_HOUR = 4

function perUnit(s: Session, rates: Rates): number {
  return s.rateFromFile != null ? s.rateFromFile : (rates[s.payerType]?.[s.cpt] ?? 0)
}

export function computeMetrics(sessions: Session[], rates: Rates, today = new Date()) {
  const A = sessions.map((s) => {
    const r = perUnit(s, rates)
    return { ...s, _rate: r, schedVal: s.unitsScheduled * r, rendVal: s.unitsRendered * r }
  })
  const S = A.filter((r) => !r.date || new Date(r.date) <= today)
  const upcoming = A.filter(
    (r) => r.date && new Date(r.date) > today && r.sessionStatus !== 'Deleted'
  )
  const sum = <T>(rows: T[], f: keyof T | ((r: T) => number)) =>
    typeof f === 'function' ? _.sumBy(rows, f) : _.sumBy(rows, f as string)

  const booked = S.filter((r) => r.sessionStatus !== 'Deleted')
  const delivered = S.filter((r) => S_DELIVERED.has(r.sessionStatus))
  const documented = S.filter((r) => S_DOCUMENTED.has(r.sessionStatus))
  const claimed = S.filter((r) => r.claimNo)
  const collectedRows = S.filter((r) => r.paidAlloc > 0)

  const stages = [
    {
      key: 'sched',
      label: 'Scheduled',
      units: sum(booked, 'unitsScheduled'),
      value: sum(booked, 'schedVal'),
      sub: 'Booked in Artemis',
    },
    {
      key: 'deliv',
      label: 'Delivered',
      units: sum(delivered, 'unitsRendered'),
      value: sum(delivered, 'rendVal'),
      sub: 'Sessions actually run',
    },
    {
      key: 'doc',
      label: 'Documented',
      units: sum(documented, 'unitsRendered'),
      value: sum(documented, 'rendVal'),
      sub: 'Ready to bill',
    },
    {
      key: 'claim',
      label: 'Claimed',
      units: sum(claimed, 'unitsRendered'),
      value: sum(claimed, 'rendVal'),
      sub: 'Sent to payer',
    },
    {
      key: 'paid',
      label: 'Collected',
      units: sum(collectedRows, 'unitsRendered'),
      value: sum(S, 'paidAlloc'),
      sub: 'Cash received',
    },
  ]

  const claimedAllowed = sum(claimed, 'rendVal')
  const collected = sum(S, 'paidAlloc')

  const incomplete = S.filter((r) => r.sessionStatus === 'Incomplete')
  const notClaimed = S.filter(
    (r) =>
      r.sessionStatus === 'Completed' ||
      (r.sessionStatus === 'Ready to Bill' && !r.claimNo)
  )
  const pending = S.filter((r) => r.claimStatus === 'Submitted' && r.paidAlloc <= 0)
  const denied = S.filter((r) => r.claimStatus === 'Denied')
  const clientAR = S.filter((r) => r.claimStatus === 'Client')
  const cancelled = S.filter((r) => r.sessionStatus === 'Cancelled')
  const mismatch = delivered.filter((r) => r.unitsScheduled !== r.unitsRendered)

  const atRisk =
    sum(incomplete, 'rendVal') +
    sum(notClaimed, 'rendVal') +
    sum(pending, 'rendVal') +
    sum(denied, 'rendVal')
  const recoverable =
    sum(incomplete, 'rendVal') + sum(notClaimed, 'rendVal') + sum(denied, 'rendVal')
  const collectionRate = claimedAllowed > 0 ? collected / claimedAllowed : 0
  const deniedVal = sum(denied, 'rendVal')
  const paidClaimVal = sum(
    claimed.filter((r) => r.paidAlloc > 0),
    'rendVal'
  )
  const denialRate =
    paidClaimVal + deniedVal > 0 ? deniedVal / (paidClaimVal + deniedVal) : 0

  const byPayer = _(S)
    .groupBy('payer')
    .map((rows, payer) => {
      const pu = sum(
        rows.filter((r) => r.paidAlloc > 0),
        'unitsRendered'
      )
      const den = rows.filter((r) => r.claimStatus === 'Denied')
      const paidClaim = sum(
        rows.filter((r) => r.paidAlloc > 0),
        'rendVal'
      )
      const denV = sum(den, 'rendVal')
      return {
        payer,
        payerType: rows[0].payerType,
        sessions: rows.filter((r) => S_DELIVERED.has(r.sessionStatus)).length,
        hours:
          sum(
            rows.filter((r) => S_DELIVERED.has(r.sessionStatus)),
            'unitsRendered'
          ) / UNITS_PER_HOUR,
        charge: sum(
          rows.filter((r) => r.claimNo),
          'charge'
        ),
        claimed: sum(
          rows.filter((r) => r.claimNo),
          'rendVal'
        ),
        collected: sum(rows, 'paidAlloc'),
        effRate: pu > 0 ? sum(rows, 'paidAlloc') / pu : 0,
        denialRate: paidClaim + denV > 0 ? denV / (paidClaim + denV) : 0,
      }
    })
    .orderBy(['collected'], ['desc'])
    .value()

  const byType = _(S)
    .groupBy('payerType')
    .map((rows, type) => ({ type, collected: sum(rows, 'paidAlloc') }))
    .value()

  const byCpt = _(delivered)
    .groupBy('cpt')
    .map((rows, cpt) => ({
      cpt,
      label: CPT_META[cpt]?.label || cpt,
      provider: rows[0]?.providerRole || CPT_META[cpt]?.provider || '',
      units: sum(rows, 'unitsRendered'),
      hours: sum(rows, 'unitsRendered') / UNITS_PER_HOUR,
      value: sum(rows, 'rendVal'),
      share: 0,
    }))
    .orderBy(['value'], ['desc'])
    .value()
  const cptTot = sum(byCpt, 'value') || 1
  byCpt.forEach((r) => {
    r.share = r.value / cptTot
  })

  const byWeek = _(claimed)
    .groupBy('week')
    .map((rows, week) => ({
      week: (week || '').slice(5),
      claimed: sum(rows, 'rendVal'),
      collected: sum(rows, 'paidAlloc'),
    }))
    .orderBy(['week'], ['asc'])
    .value()
    .filter((w) => w.week)

  const denialByReason = _(denied)
    .groupBy((r) => r.payer)
    .map((rows, key) => ({
      reason: key,
      count: rows.length,
      value: sum(rows, 'rendVal'),
    }))
    .orderBy(['value'], ['desc'])
    .value()

  const aging = [
    { label: '0–30 days', min: 0, max: 30, value: 0 },
    { label: '31–60 days', min: 31, max: 60, value: 0 },
    { label: '61–90 days', min: 61, max: 90, value: 0 },
    { label: '90+ days', min: 91, max: 1e9, value: 0 },
  ]
  denied.forEach((r) => {
    const age = r.date ? Math.round((+today - +new Date(r.date)) / 864e5) : 0
    const b = aging.find((x) => age >= x.min && age <= x.max)
    if (b) b.value += r.rendVal
  })

  return {
    stages,
    deliveredUnits: sum(delivered, 'unitsRendered'),
    billableHours: sum(delivered, 'unitsRendered') / UNITS_PER_HOUR,
    claimedAllowed,
    collected,
    collectionRate,
    denialRate,
    atRisk,
    recoverable,
    counts: {
      delivered: delivered.length,
      clients: _.uniq(S.map((r) => r.clientId || r.client)).length,
      cancelled: cancelled.length + S.filter((r) => r.sessionStatus === 'Deleted').length,
    },
    upcoming: {
      count: upcoming.length,
      units: sum(upcoming, 'unitsScheduled'),
      value: sum(upcoming, 'schedVal'),
    },
    byPayer,
    byType,
    byCpt,
    byWeek,
    denialByReason,
    aging,
    leakage: {
      incomplete: { rows: incomplete, value: sum(incomplete, 'rendVal') },
      notClaimed: { rows: notClaimed, value: sum(notClaimed, 'rendVal') },
      pending: { rows: pending, value: sum(pending, 'rendVal') },
      denied: { rows: denied, value: sum(denied, 'rendVal') },
      clientAR: { rows: clientAR, value: sum(clientAR, 'rendVal') },
      cancelled: { rows: cancelled, value: sum(cancelled, 'schedVal') },
      mismatch: {
        rows: mismatch,
        value: sum(mismatch, (r) => Math.abs(r.unitsScheduled - r.unitsRendered) * r._rate),
      },
    },
  }
}

export type Metrics = ReturnType<typeof computeMetrics>
