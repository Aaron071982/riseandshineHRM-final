import { CrmAccessError } from '@/lib/crm/access'

/** Server-side gate for irreversible or high-risk actions (must not rely on UI alone). */
export function requireDestructiveConfirm(
  confirmed: unknown,
  message = 'Confirmation required — retry with confirmed: true after user acknowledgment'
): void {
  if (confirmed !== true) {
    throw new CrmAccessError(message, 400)
  }
}
