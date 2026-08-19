const RISE_AND_SHINE_DOMAIN = '@riseandshineaba.com'

export function hasRiseAndShineMailbox(email: string | null | undefined): boolean {
  if (!email?.trim()) return false
  return email.trim().toLowerCase().endsWith(RISE_AND_SHINE_DOMAIN)
}

export function mailboxBlockedReason(
  email: string | null | undefined
): string | null {
  if (!email?.trim()) {
    return 'Your account has no email address on file.'
  }
  if (!hasRiseAndShineMailbox(email)) {
    return `Sending requires a Rise & Shine mailbox (${RISE_AND_SHINE_DOMAIN.slice(1)}). Your account uses ${email}.`
  }
  return null
}
