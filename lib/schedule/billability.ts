import type { SessionBillabilityStatus } from '@prisma/client'

type CoverageLine = {
  cptCode: string
  authRequired: boolean | null
}

type CoverageAuth = {
  effectiveDate: Date | null
  expirationDate: Date | null
  renderingProviderId: string | null
  serviceLocation: string | null
  lines: CoverageLine[]
}

export function computeSessionBillability(params: {
  dateOfService: Date
  cptCode: string
  renderingProviderId?: string | null
  serviceLocation?: string | null
  authorizations: CoverageAuth[]
}): { status: SessionBillabilityStatus; reason: string } {
  const dos = params.dateOfService.getTime()
  const cpt = params.cptCode.trim().toUpperCase()
  if (!cpt) return { status: 'UNKNOWN', reason: 'Missing CPT code' }

  for (const auth of params.authorizations) {
    if (!auth.effectiveDate || !auth.expirationDate) continue
    const inRange =
      auth.effectiveDate.getTime() <= dos && auth.expirationDate.getTime() >= dos
    if (!inRange) continue
    if (
      params.renderingProviderId &&
      auth.renderingProviderId &&
      auth.renderingProviderId !== params.renderingProviderId
    ) {
      continue
    }
    if (
      params.serviceLocation &&
      auth.serviceLocation &&
      auth.serviceLocation !== params.serviceLocation
    ) {
      continue
    }
    const matchingLine = auth.lines.find((line) => line.cptCode.toUpperCase() === cpt)
    if (!matchingLine) continue
    if (matchingLine.authRequired === false) {
      return { status: 'COVERED', reason: 'Plan marks CPT as no-auth-required' }
    }
    return { status: 'COVERED', reason: 'Covered by active treatment authorization' }
  }

  return {
    status: 'NOT_COVERED',
    reason: 'No active auth covers DOS + CPT + provider + location',
  }
}
