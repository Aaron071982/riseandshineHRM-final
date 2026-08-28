import fs from 'fs'
import path from 'path'
import type { CommTemplate } from '@prisma/client'
import { resolveParentFormPath } from '@/lib/crm/emails/parentFormDownloads'

/**
 * Static parent forms auto-attached to journey emails.
 * Resolved from public/parent-forms, email-docs, or assets/crm-parent-forms.
 */
export type TemplateFormAttachment = {
  fileName: string
  contentType: 'application/pdf'
  contentBytes: Buffer
  sizeBytes: number
}

/** Display names as attached on the email. */
const TEMPLATE_FORMS: Partial<Record<CommTemplate, { file: string; fileName: string }[]>> =
  {
    WELCOME: [
      { file: 'WelcomePacket.pdf', fileName: 'WelcomePacket.pdf' },
    ],
    CONSENT_REQUEST: [],
  }

export function templateFormSpecs(template: CommTemplate) {
  return TEMPLATE_FORMS[template] ?? []
}

export function loadTemplateFormAttachments(
  template: CommTemplate
): TemplateFormAttachment[] {
  const specs = templateFormSpecs(template)
  if (!specs.length) return []

  const out: TemplateFormAttachment[] = []
  for (const spec of specs) {
    const full = resolveParentFormPath(spec.file)
    if (!full) {
      console.error(`[crm-email] missing template form: ${spec.file}`)
      throw new Error(
        `Required email form is missing on the server: ${spec.fileName}`
      )
    }
    const contentBytes = fs.readFileSync(full)
    out.push({
      fileName: spec.fileName,
      contentType: 'application/pdf',
      contentBytes,
      sizeBytes: contentBytes.length,
    })
  }
  return out
}

/** Lightweight meta for preview HTML strip. */
export function templateFormAttachmentMetas(
  template: CommTemplate
): { fileName: string; sizeBytes: number }[] {
  const specs = templateFormSpecs(template)
  return specs.map((spec) => {
    const full = resolveParentFormPath(spec.file)
    let sizeBytes = 0
    if (full) {
      try {
        sizeBytes = fs.statSync(full).size
      } catch {
        sizeBytes = 0
      }
    }
    return { fileName: spec.fileName, sizeBytes }
  })
}
