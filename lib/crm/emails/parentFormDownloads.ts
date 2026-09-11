import type { CommTemplate } from '@prisma/client'
import { getPublicBaseUrl } from '@/lib/baseUrl'

/** Safe public slugs → on-disk PDF file names. */
export const PARENT_FORM_FILES = {
  'welcome-packet': {
    file: 'WelcomePacket.pdf',
    label: 'Download Welcome Packet (PDF)',
  },
  'intake-form': {
    file: 'IntakeForm.pdf',
    label: 'Download Intake Form (PDF)',
  },
  'consent-form': {
    file: 'ConsentForm.pdf',
    label: 'Download Consent Form (PDF)',
  },
} as const

export type ParentFormSlug = keyof typeof PARENT_FORM_FILES

export function isParentFormSlug(v: string): v is ParentFormSlug {
  return Object.prototype.hasOwnProperty.call(PARENT_FORM_FILES, v)
}

export function parentFormPublicUrl(slug: ParentFormSlug): string {
  // Static file under public/ — always available on Vercel CDN (no serverless FS).
  // Emails must never point at localhost — use the production site when BASE_URL is unset/local.
  const base = getPublicBaseUrl()
  const origin =
    /localhost|127\.0\.0\.1/i.test(base)
      ? 'https://www.riseandshinehrm.com'
      : base.replace(/\/$/, '')
  return `${origin}/parent-forms/${PARENT_FORM_FILES[slug].file}`
}

/** Branded download buttons auto-injected for journey emails. */
export function templateFormDownloadLinks(
  template: CommTemplate
): { url: string; label: string }[] {
  if (template === 'WELCOME' || template === 'CONSENT_REQUEST') {
    return [
      {
        url: parentFormPublicUrl('welcome-packet'),
        label: PARENT_FORM_FILES['welcome-packet'].label,
      },
      {
        url: parentFormPublicUrl('intake-form'),
        label: PARENT_FORM_FILES['intake-form'].label,
      },
      {
        url: parentFormPublicUrl('consent-form'),
        label: PARENT_FORM_FILES['consent-form'].label,
      },
    ]
  }
  return []
}
