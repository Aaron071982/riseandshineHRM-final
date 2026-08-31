import { ASSESSMENT_FILES_BUCKET } from '@/lib/constants'

export { ASSESSMENT_FILES_BUCKET as CASE_COORDINATION_FILES_BUCKET }

const UNSAFE_FILENAME = /[^a-zA-Z0-9._-]+/g

export function buildCaseCoordinationPdfPath(input: {
  serviceClientId: string
  recordId: string
  clientCode?: string
}): string {
  const code = (input.clientCode ?? 'client').replace(UNSAFE_FILENAME, '_')
  return `clients/${input.serviceClientId}/case-coordination/${input.recordId}/${code}-case-coordination.pdf`
}
