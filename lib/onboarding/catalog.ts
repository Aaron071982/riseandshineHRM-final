import type {
  OnboardingDocumentCategory,
  OnboardingDocumentType,
  OnboardingFlowType,
  OnboardingTier,
} from '@prisma/client'

export const ESIGN_CONSENT_SLUG = 'esignature-consent'
export const TOTAL_ONBOARDING_STEPS = 32
export const RBT_VISIBLE_STEPS = 30
export const TIER_A_LAST_STEP = 25
export const TIER_B_FIRST_STEP = 26
export const TIER_B_LAST_STEP = 30

export type CatalogEntry = {
  stepNumber: number
  title: string
  slug: string
  type: OnboardingDocumentType
  category: OnboardingDocumentCategory
  flowType: OnboardingFlowType
  tier: OnboardingTier
  unlockGroup: string | null
  folder: string
  file: string | null
  isRequired: boolean
}

/** Canonical 32-step onboarding catalog (steps 31–32 are admin-only). */
export const ONBOARDING_CATALOG: CatalogEntry[] = [
  { stepNumber: 1, title: 'E-Signature Consent', slug: ESIGN_CONSENT_SLUG, type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'ESIGN', tier: 'TIER_A', unlockGroup: null, folder: 'ACKNOWLEDGMENT_FORMS', file: 'RiseShine_12_ESignatureConsent_v1.docx.pdf', isRequired: true },
  { stepNumber: 2, title: 'Welcome Letter', slug: 'welcome-letter', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'ESIGN', tier: 'TIER_A', unlockGroup: null, folder: 'ACKNOWLEDGMENT_FORMS', file: 'RiseShine_01_WelcomeLetter_v2.docx.pdf', isRequired: true },
  { stepNumber: 3, title: 'Employee Handbook', slug: 'employee-handbook', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'ESIGN', tier: 'TIER_A', unlockGroup: null, folder: 'ACKNOWLEDGMENT_FORMS', file: 'RiseShine_02_EmployeeHandbook_v2.docx.pdf', isRequired: true },
  { stepNumber: 4, title: 'HIPAA & Confidentiality', slug: 'hipaa-confidentiality', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'ESIGN', tier: 'TIER_A', unlockGroup: null, folder: 'ACKNOWLEDGMENT_FORMS', file: 'RiseShine_03_HIPAA_Confidentiality_v2.docx.pdf', isRequired: true },
  { stepNumber: 5, title: 'Non-Disclosure Agreement (NDA)', slug: 'nda', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'ESIGN', tier: 'TIER_A', unlockGroup: null, folder: 'ACKNOWLEDGMENT_FORMS', file: 'RiseShine_04_NDA_v2.docx.pdf', isRequired: true },
  { stepNumber: 6, title: 'Mandated Reporter Acknowledgment', slug: 'mandated-reporter-ack', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'ESIGN', tier: 'TIER_A', unlockGroup: null, folder: 'ACKNOWLEDGMENT_FORMS', file: 'Mandated Reporter Acknowledgment Form.pdf', isRequired: true },
  { stepNumber: 7, title: 'Emergency & Incident Reporting Policy', slug: 'incident-reporting-policy', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'ESIGN', tier: 'TIER_A', unlockGroup: null, folder: 'ACKNOWLEDGMENT_FORMS', file: 'RiseShine_05_IncidentReporting_v2.docx.pdf', isRequired: true },
  { stepNumber: 8, title: 'Session Note Policy', slug: 'session-note-policy', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'ESIGN', tier: 'TIER_A', unlockGroup: null, folder: 'ACKNOWLEDGMENT_FORMS', file: 'RiseShine_06_SessionNotePolicy_v1.docx.pdf', isRequired: true },
  { stepNumber: 9, title: 'Time Recording Policy', slug: 'time-recording-policy', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'ESIGN', tier: 'TIER_A', unlockGroup: null, folder: 'ACKNOWLEDGMENT_FORMS', file: 'RiseShine_07_TimeRecordingPolicy_v1.docx.pdf', isRequired: true },
  { stepNumber: 10, title: 'Documentation & Time Acknowledgment', slug: 'doc-time-acknowledgment', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'ESIGN', tier: 'TIER_A', unlockGroup: null, folder: 'ACKNOWLEDGMENT_FORMS', file: 'RiseShine_08_DocAndTimeAcknowledgment_v1.docx.pdf', isRequired: true },
  { stepNumber: 11, title: 'Sexual Harassment Policy Acknowledgment', slug: 'sexual-harassment-acknowledgment', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'ESIGN', tier: 'TIER_A', unlockGroup: null, folder: 'ACKNOWLEDGMENT_FORMS', file: 'RiseShine_09_SexualHarassmentAcknowledgment_v1.docx.pdf', isRequired: true },
  { stepNumber: 12, title: 'OIG/SAM/OMIG Self-Attestation', slug: 'oig-self-attestation', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'ESIGN', tier: 'TIER_A', unlockGroup: null, folder: 'ACKNOWLEDGMENT_FORMS', file: 'RiseShine_10_OIG_SAM_OMIG_SelfAttestation_v1.docx.pdf', isRequired: true },
  { stepNumber: 13, title: 'RBT Supervision Contract', slug: 'rbt-supervision-contract', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'ESIGN', tier: 'TIER_A', unlockGroup: null, folder: 'ACKNOWLEDGMENT_FORMS', file: 'RiseShine_11_RBT_SupervisionContract_v1.docx.pdf', isRequired: true },
  { stepNumber: 14, title: 'FCRA Disclosure', slug: 'fcra-disclosure', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'NOTICE', tier: 'TIER_A', unlockGroup: 'notices', folder: 'ACKNOWLEDGMENT_FORMS', file: 'RiseShine_13_FCRA_Disclosure_v1.docx.pdf', isRequired: true },
  { stepNumber: 15, title: 'CFPB Consumer Rights Summary', slug: 'cfpb-consumer-rights', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'NOTICE', tier: 'TIER_A', unlockGroup: 'notices', folder: 'ACKNOWLEDGMENT_FORMS', file: '201504_cfpb_summary_your-rights-under-fcra.pdf', isRequired: true },
  { stepNumber: 16, title: 'NYS Disability Benefits Notice (DB-271S)', slug: 'db271s', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'NOTICE', tier: 'TIER_A', unlockGroup: 'notices', folder: 'ACKNOWLEDGMENT_FORMS', file: 'db271s.pdf', isRequired: true },
  { stepNumber: 17, title: 'Paid Family Leave Notice (PFL-271S)', slug: 'pfl271s', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'NOTICE', tier: 'TIER_A', unlockGroup: 'notices', folder: 'ACKNOWLEDGMENT_FORMS', file: 'PFL271S.pdf', isRequired: true },
  { stepNumber: 18, title: 'Paid Safe & Sick Leave Notice', slug: 'paid-sick-leave-notice', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'NOTICE', tier: 'TIER_A', unlockGroup: 'notices', folder: 'ACKNOWLEDGMENT_FORMS', file: 'PaidSafeSickLeave-MandatoryNotice-English.pdf', isRequired: true },
  { stepNumber: 19, title: 'Breast Milk Expression Rights Notice (P705)', slug: 'breast-milk-rights-notice', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'NOTICE', tier: 'TIER_A', unlockGroup: 'notices', folder: 'ACKNOWLEDGMENT_FORMS', file: 'p705-policy-on-the-rights-of-employees-to-express-breast-milk-in-the-workplace_-24-1.pdf', isRequired: true },
  { stepNumber: 20, title: 'Form W-4', slug: 'form-w4', type: 'FILLABLE_PDF', category: 'DOWNLOAD_REUPLOAD', flowType: 'NATIVE_FORM', tier: 'TIER_A', unlockGroup: 'fillable_forms', folder: 'COMPLETED_ONBOARDING_FORMS', file: '2025 Form W-4.pdf', isRequired: true },
  { stepNumber: 21, title: 'Form IT-2104 (NYS Tax Withholding)', slug: 'it2104', type: 'FILLABLE_PDF', category: 'DOWNLOAD_REUPLOAD', flowType: 'NATIVE_FORM', tier: 'TIER_A', unlockGroup: 'fillable_forms', folder: 'COMPLETED_ONBOARDING_FORMS', file: 'it2104_fill_in (1).pdf', isRequired: true },
  { stepNumber: 22, title: 'Direct Deposit Authorization', slug: 'direct-deposit', type: 'FILLABLE_PDF', category: 'DOWNLOAD_REUPLOAD', flowType: 'NATIVE_FORM', tier: 'TIER_A', unlockGroup: 'fillable_forms', folder: 'COMPLETED_ONBOARDING_FORMS', file: 'Direct Deposit Authorization Form.pdf', isRequired: true },
  { stepNumber: 23, title: 'NYS Wage Notice (LS-54)', slug: 'ls54-wage-notice', type: 'FILLABLE_PDF', category: 'HR_INITIATED', flowType: 'NATIVE_FORM', tier: 'TIER_A', unlockGroup: 'fillable_forms', folder: 'COMPLETED_ONBOARDING_FORMS', file: 'LS54.pdf', isRequired: true },
  { stepNumber: 24, title: 'Background Check Authorization', slug: 'background-check-authorization', type: 'FILLABLE_PDF', category: 'DOWNLOAD_REUPLOAD', flowType: 'NATIVE_FORM', tier: 'TIER_A', unlockGroup: 'fillable_forms', folder: 'COMPLETED_ONBOARDING_FORMS', file: 'BackgroundCheckLetter.pdf', isRequired: true },
  { stepNumber: 25, title: 'Upload Social Security Card', slug: 'upload-social-security-card', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'UPLOAD', tier: 'TIER_A', unlockGroup: 'fillable_forms', folder: 'PERSONAL_DOCUMENTS', file: null, isRequired: true },
  { stepNumber: 26, title: 'Sexual Harassment Prevention Training + Quiz', slug: 'sexual-harassment-training', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'TRAINING_QUIZ', tier: 'TIER_B', unlockGroup: null, folder: 'RBT_CERTIFICATE', file: 'RiseShine_SexualHarassmentPolicy_v1.pdf', isRequired: true },
  { stepNumber: 27, title: 'Mandated Reporter Training Certificate', slug: 'mandated-reporter-certificate', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'UPLOAD', tier: 'TIER_B', unlockGroup: null, folder: 'RBT_CERTIFICATE', file: null, isRequired: true },
  { stepNumber: 28, title: 'CPR/First Aid Certificate', slug: 'cpr-first-aid-certificate', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'UPLOAD', tier: 'TIER_B', unlockGroup: null, folder: 'RBT_CERTIFICATE', file: null, isRequired: true },
  { stepNumber: 29, title: '40-Hour RBT Training Certificate', slug: 'forty-hour-rbt-certificate', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'UPLOAD', tier: 'TIER_B', unlockGroup: null, folder: 'RBT_CERTIFICATE', file: null, isRequired: true },
  { stepNumber: 30, title: 'Artemis Training Booking & Completion', slug: 'artemis-training', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'BOOKING', tier: 'TIER_B', unlockGroup: null, folder: 'RBT_CERTIFICATE', file: null, isRequired: true },
  { stepNumber: 31, title: 'Background Check Cleared (Admin)', slug: 'background-check-cleared', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'ADMIN_ONLY', tier: 'ACTIVATION', unlockGroup: null, folder: 'ACKNOWLEDGMENT_FORMS', file: null, isRequired: true },
  { stepNumber: 32, title: 'Supervision Contract Countersigned (Admin)', slug: 'supervision-countersigned', type: 'ACKNOWLEDGMENT', category: 'ESIGN_ONLY', flowType: 'ADMIN_ONLY', tier: 'ACTIVATION', unlockGroup: null, folder: 'ACKNOWLEDGMENT_FORMS', file: null, isRequired: true },
]

export function getCatalogEntry(stepNumber: number): CatalogEntry | undefined {
  return ONBOARDING_CATALOG.find((e) => e.stepNumber === stepNumber)
}

export function getRbtVisibleCatalog(): CatalogEntry[] {
  return ONBOARDING_CATALOG.filter((e) => e.flowType !== 'ADMIN_ONLY')
}
