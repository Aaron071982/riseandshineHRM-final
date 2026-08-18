/**
 * Parent-journey email safety rails (Part B).
 * Kill-switch off by default; non-prod never hits real parent inboxes.
 */

export function crmEmailsEnabled(): boolean {
  return process.env.CRM_EMAILS_ENABLED === 'true'
}

/**
 * Parent stage-transition emails have a separate opt-in switch. Keeping this
 * false leaves templates and delivery code available without generating,
 * logging, retrying, or sending a message on every stage change.
 */
export function crmJourneyEmailsEnabled(): boolean {
  return process.env.CRM_JOURNEY_EMAILS_ENABLED === 'true'
}

/** True only on Vercel production (or NODE_ENV production when not on Vercel). */
export function isCrmEmailProductionEnv(): boolean {
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV === 'production'
  }
  return process.env.NODE_ENV === 'production'
}

/**
 * Resolve the outbound To address.
 * - Kill-switch off → null (caller records SKIPPED, no send)
 * - Non-prod (or enabled but not prod) → CRM_EMAIL_TEST_INBOX, or null to drop
 * - Prod + enabled → real parent email
 */
export function resolveCrmEmailRecipient(parentEmail: string | null | undefined): {
  to: string | null
  redirected: boolean
  reason: string | null
} {
  if (!crmEmailsEnabled()) {
    return {
      to: null,
      redirected: false,
      reason: 'CRM_EMAILS_ENABLED is not true',
    }
  }

  const real = parentEmail?.trim() || ''
  if (!real || !real.includes('@')) {
    return { to: null, redirected: false, reason: 'No parent email on file' }
  }

  if (isCrmEmailProductionEnv()) {
    return { to: real, redirected: false, reason: null }
  }

  const testInbox = process.env.CRM_EMAIL_TEST_INBOX?.trim() || ''
  if (!testInbox) {
    return {
      to: null,
      redirected: false,
      reason: 'Non-prod: CRM_EMAIL_TEST_INBOX not set — drop',
    }
  }
  return {
    to: testInbox,
    redirected: true,
    reason: `Non-prod redirect → ${testInbox}`,
  }
}

/** Statuses that lock a (client, template) against another automatic send. */
export const JOURNEY_LOCK_STATUSES = ['SENT', 'SKIPPED'] as const

export function isJourneyLockedStatus(status: string | null | undefined): boolean {
  return (
    !!status &&
    (JOURNEY_LOCK_STATUSES as readonly string[]).includes(status.toUpperCase())
  )
}
