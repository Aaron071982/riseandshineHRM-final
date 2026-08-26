import fs from 'fs'
import path from 'path'
import type { CommTemplate } from '@prisma/client'
import { makePublicUrl } from '@/lib/baseUrl'

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

/** Prefer public/ (always on Vercel) then email-docs/ then assets/. */
export function parentFormSearchDirs(): string[] {
  return [
    path.join(process.cwd(), 'public', 'parent-forms'),
    path.join(process.cwd(), 'email-docs'),
    path.join(process.cwd(), 'assets', 'crm-parent-forms'),
  ]
}

export function resolveParentFormPath(fileName: string): string | null {
  const safe = path.basename(fileName)
  for (const dir of parentFormSearchDirs()) {
    const full = path.join(dir, safe)
    if (fs.existsSync(full)) return full
  }
  return null
}

export function parentFormPublicUrl(slug: ParentFormSlug): string {
  // Static file under public/ — always available on Vercel CDN (no serverless FS).
  return makePublicUrl(`/parent-forms/${PARENT_FORM_FILES[slug].file}`)
}

/** Branded download buttons auto-injected for journey emails. */
export function templateFormDownloadLinks(
  template: CommTemplate
): { url: string; label: string }[] {
  if (template === 'WELCOME') {
    return [
      {
        url: parentFormPublicUrl('welcome-packet'),
        label: PARENT_FORM_FILES['welcome-packet'].label,
      },
    ]
  }
  if (template === 'CONSENT_REQUEST') {
    return [
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
