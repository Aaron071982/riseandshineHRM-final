/**
 * Form I-9 collection outreach (same logic as Admin → Compliance → Form I-9).
 *
 * Usage:
 *   npx tsx scripts/i9-outreach.ts            # preview recipients (no email)
 *   npx tsx scripts/i9-outreach.ts --send     # send the initial request to anyone not yet emailed
 *   npx tsx scripts/i9-outreach.ts --reminders # send due day-3 / day-7 reminders
 */
import { prisma } from '@/lib/prisma'
import {
  getI9OutreachOverview,
  i9TaskLink,
  sendDueI9Reminders,
  sendI9CollectionRequest,
} from '@/lib/compliance/i9Outreach'

async function main() {
  const link = i9TaskLink()
  if (!link.startsWith('https://')) {
    throw new Error(`I-9 task link is not a public URL (${link}); set NEXT_PUBLIC_BASE_URL.`)
  }

  if (process.argv.includes('--send')) {
    console.log(await sendI9CollectionRequest(null))
    return
  }
  if (process.argv.includes('--reminders')) {
    console.log(await sendDueI9Reminders())
    return
  }

  const o = await getI9OutreachOverview()
  for (const r of o.recipients) {
    console.log(`${r.firstName} ${r.lastName} <${r.email}>${r.requestSentAt ? ` (sent ${r.requestSentAt.slice(0, 10)})` : ''}`)
  }
  console.log(
    `\nMissing an I-9: ${o.recipients.length}; not yet emailed: ${o.pendingRequestCount}; link: ${o.i9TaskLink}; email configured: ${o.resendConfigured}`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
