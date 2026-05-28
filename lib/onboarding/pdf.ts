/** Stream a catalog PDF for the logged-in RBT (avoids embedding base64 in RSC props). */
export function rbtOnboardingPdfUrl(documentId: string): string {
  return `/api/rbt/onboarding/documents/${documentId}/pdf`
}
