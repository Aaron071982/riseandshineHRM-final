import { redirect } from 'next/navigation'
import { CRM_SCHEDULE_IMPORT_PATH } from '@/lib/schedule/paths'

export const dynamic = 'force-dynamic'

export default function LegacyScheduleImportRedirect() {
  redirect(CRM_SCHEDULE_IMPORT_PATH)
}
