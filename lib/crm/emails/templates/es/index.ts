import type { CommTemplate } from '@prisma/client'
import type { StaffEmailContent, StaffMergeFields } from '../types'
import { renderCaseCoordinationEs } from './caseCoordination'
import { renderMeetAndGreetEs } from './meetAndGreet'
import {
  LEGACY_RENDERERS_ES,
  renderAssessmentScheduledEs,
  renderAuthApprovedEs,
  renderBenefitsUpdateEs,
  renderConsentRequestEs,
  renderDocsNeededEs,
  renderRbtAssignedEs,
  renderReadyForStaffingEs,
  renderScheduleConfirmedEs,
  renderWelcomeEs,
} from './simple'

export const RENDERERS_ES: Partial<
  Record<CommTemplate, (f: StaffMergeFields) => StaffEmailContent>
> = {
  WELCOME: renderWelcomeEs,
  CONSENT_REQUEST: renderConsentRequestEs,
  DOCS_NEEDED: renderDocsNeededEs,
  BENEFITS_UPDATE: renderBenefitsUpdateEs,
  ASSESSMENT_SCHEDULED: renderAssessmentScheduledEs,
  AUTH_APPROVED: renderAuthApprovedEs,
  READY_FOR_STAFFING: renderReadyForStaffingEs,
  RBT_ASSIGNED: renderRbtAssignedEs,
  SCHEDULE_CONFIRMED: renderScheduleConfirmedEs,
  MEET_AND_GREET: renderMeetAndGreetEs,
  CASE_COORDINATION: renderCaseCoordinationEs,
  ...LEGACY_RENDERERS_ES,
}
