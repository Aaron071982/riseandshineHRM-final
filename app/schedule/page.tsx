import { redirect } from 'next/navigation'
import { crmScheduleHref } from '@/lib/schedule/paths'

export const dynamic = 'force-dynamic'

export default function LegacyScheduleRedirect({
  searchParams,
}: {
  searchParams?: { periodStart?: string; periodEnd?: string; borough?: string }
}) {
  redirect(
    crmScheduleHref({
      periodStart: searchParams?.periodStart,
      periodEnd: searchParams?.periodEnd,
      borough: searchParams?.borough,
    })
  )
}
