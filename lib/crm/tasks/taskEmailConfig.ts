import { runtimeEnvFlag } from '@/lib/env/runtimeFlag'

/** Primary kill-switch (Phase F). Default false — dark launch. */
export function taskEmailsEnabled(): boolean {
  if (runtimeEnvFlag('TASK_EMAILS_ENABLED')) return true
  // Legacy alias during rollout
  return runtimeEnvFlag('CRM_TASK_EMAILS_ENABLED')
}

export function taskEmailsTestSend(): boolean {
  return runtimeEnvFlag('TASK_EMAILS_TEST_SEND')
}

export function taskEmailsTestEmail(): string | null {
  const raw =
    process.env.TASK_EMAILS_TEST_EMAIL?.trim() ||
    process.env.CRM_TASK_EMAILS_TEST_EMAIL?.trim()
  return raw ? raw.toLowerCase() : null
}

/** @deprecated Use taskEmailsEnabled */
export function crmTaskEmailsEnabled(): boolean {
  return taskEmailsEnabled()
}
