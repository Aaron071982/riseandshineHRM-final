import { resolveCaseStatus, type CaseStatus } from '@/lib/clients/status'

export type ClientRow = {
  id: string
  name: string
  code: string | null
  status: CaseStatus
  bcba: string | null
  location: string | null
  address: string | null
  behaviorTechs: string[]
  hours: { scheduled: number; target: number } | null
  docs: { done: number; total: number }
  href: string
  needsAdditionalHours?: boolean
  onBreak?: boolean
  receivingServices?: boolean
  needsRbt?: boolean
}

export type ApiCaseloadClient = {
  id: string
  clientCode: string
  firstName: string
  lastName: string
  status: string
  borough: string | null
  addressLine?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  bcbaName: string | null
  authHours: number | null
  scheduledHoursPerWeek: number
  needsAdditionalHours: boolean
  needsRbt: boolean
  receivingServices?: boolean
  scheduleLinked?: boolean
  boardBucket: string
  btNames: string[]
  docsCollected: number
  docsTotal: number
  activeClientBreak: unknown | null
  activeRbtBreaks: unknown[]
}

/** Display as first initial + last name (e.g. "J. Smith") on the caseload dashboard. */
export function formatClientDisplayName(firstName: string, lastName: string): string {
  const first = (firstName ?? '').trim()
  const last = (lastName ?? '').trim()
  const initial = first ? `${first[0]!.toUpperCase()}.` : ''
  return [initial, last].filter(Boolean).join(' ') || 'Unknown'
}

export function formatClientAddress(c: {
  addressLine?: string | null
  city?: string | null
  borough?: string | null
  state?: string | null
  zip?: string | null
}): string | null {
  const line = (c.addressLine ?? '').trim()
  const city = (c.city ?? c.borough ?? '').trim()
  const state = (c.state ?? '').trim()
  const zip = (c.zip ?? '').trim()
  const cityStateZip = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const full = [line, cityStateZip].filter(Boolean).join(', ')
  return full || null
}

export function toClientRow(c: ApiCaseloadClient): ClientRow {
  const status = resolveCaseStatus(c)
  const scheduled = c.scheduledHoursPerWeek ?? 0
  const target = c.authHours
  const address = formatClientAddress(c)
  return {
    id: c.id,
    name: formatClientDisplayName(c.firstName, c.lastName),
    code: c.clientCode || null,
    status,
    bcba: c.bcbaName,
    location: c.borough,
    address,
    behaviorTechs: c.btNames ?? [],
    hours:
      target != null || scheduled > 0
        ? { scheduled, target: target ?? scheduled }
        : null,
    docs: { done: c.docsCollected ?? 0, total: c.docsTotal || 9 },
    href: `/client-services/clients/${c.id}`,
    needsAdditionalHours: c.needsAdditionalHours,
    onBreak: !!(c.activeClientBreak || (c.activeRbtBreaks?.length ?? 0) > 0),
    receivingServices: !!c.receivingServices || c.boardBucket === 'RECEIVING_SERVICES',
    needsRbt: c.needsRbt,
  }
}
