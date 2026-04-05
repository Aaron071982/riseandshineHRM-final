/** Exact consent shown above the signature field on acknowledgment documents (E-SIGN / UETA). */
export const PER_DOCUMENT_SIGNATURE_CONSENT_STATEMENT =
  "By typing my name below and clicking 'Sign Document', I am signing this document electronically. I agree that my electronic signature is the legal equivalent of my handwritten signature on this document. I have read and agree to the contents of this document."

/** Stored on signature certificates for completed fillable PDF submissions (uploaded filled form). */
export const FILLABLE_PDF_SUBMISSION_CONSENT_STATEMENT =
  'By submitting this completed PDF, I attest that the information in the attached document is true and complete to the best of my knowledge and that this submission constitutes my signed form for this document.'

/** Signature method values stored on OnboardingCompletion / certificates. */
export const SIGNATURE_METHOD = {
  TYPED_NAME: 'TYPED_NAME',
  DRAWN: 'DRAWN',
  UPLOADED: 'UPLOADED',
  PRE_COMPLIANCE: 'PRE_COMPLIANCE',
} as const

export type SignatureMethod = (typeof SIGNATURE_METHOD)[keyof typeof SIGNATURE_METHOD]
