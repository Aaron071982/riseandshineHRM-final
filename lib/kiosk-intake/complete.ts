import 'server-only'

import { prisma } from '@/lib/prisma'
import { getRequiredFormCodes } from '@/lib/kiosk-intake/schema'

/** True when the client has at least one submission for every required form code. */
export async function isIntakeComplete(serviceClientId: string): Promise<boolean> {
  const required = getRequiredFormCodes()
  if (required.length === 0) return true

  const rows = await prisma.clientIntakeSubmission.findMany({
    where: { serviceClientId },
    select: { formCode: true },
    distinct: ['formCode'],
  })
  const have = new Set(rows.map((r) => r.formCode))
  return required.every((code) => have.has(code))
}

export function missingRequiredFormCodes(submittedCodes: Iterable<string>): string[] {
  const have = new Set(submittedCodes)
  return getRequiredFormCodes().filter((code) => !have.has(code))
}
