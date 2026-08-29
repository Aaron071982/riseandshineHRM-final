/** Stream a catalog PDF for the logged-in RBT (avoids embedding base64 in RSC props). */
export function rbtOnboardingPdfUrl(
  documentId: string,
  opts?: { download?: boolean }
): string {
  const base = `/api/rbt/onboarding/documents/${documentId}/pdf`
  return opts?.download ? `${base}?download=1` : base
}
