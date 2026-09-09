import type { StaffEmailContent, StaffMergeFields } from './types'
import { renderWelcome } from './welcome'

/**
 * Same combined welcome + intake/consent + documents packet as WELCOME.
 * Kept as a separate CommTemplate so existing staff picks / journey hooks still work.
 */
export function renderConsentRequest(
  fields: StaffMergeFields
): StaffEmailContent {
  return renderWelcome(fields)
}
