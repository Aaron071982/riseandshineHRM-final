/**
 * Email module: core send + template generators.
 * Implementation split into lib/email/core.ts and lib/email/generators.ts.
 */
export {
  EmailTemplateType,
  sendEmail,
  sendGenericEmail,
  type EmailOptions,
} from './email/core'

export {
  generateApplicationReviewedEmail,
  generateReachOutEmail,
  generateInterviewInviteEmail,
  generateOfferEmail,
  generateTeamWelcomeEmail,
  generateManualHireOnboardingEmail,
  generateIdReminderEmail,
  generateSocialSecurityUploadReminderEmail,
  generateRejectionEmail,
  generateMissingOnboardingEmail,
  generateApplicationSubmissionInternalEmail,
  generateApplicationSubmissionConfirmationEmail,
  generateInterviewReminderEmail,
  generateInterviewReminder15mEmail,
} from './email/generators'
