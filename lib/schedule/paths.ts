/** CRM home for the weekly schedule board (moved from HRM `/schedule`). */
export const CRM_SCHEDULE_PATH = '/client-services/schedule'
export const CRM_SCHEDULE_IMPORT_PATH = '/client-services/schedule/import'

export function crmScheduleHref(params?: {
  periodStart?: string | null
  periodEnd?: string | null
  borough?: string | null
}): string {
  const q = new URLSearchParams()
  if (params?.periodStart) q.set('periodStart', params.periodStart)
  if (params?.periodEnd) q.set('periodEnd', params.periodEnd)
  if (params?.borough) q.set('borough', params.borough)
  const qs = q.toString()
  return qs ? `${CRM_SCHEDULE_PATH}?${qs}` : CRM_SCHEDULE_PATH
}
