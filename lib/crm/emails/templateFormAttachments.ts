import fs from 'fs'
import path from 'path'
import type { CommTemplate } from '@prisma/client'

/**
 * Static parent forms shipped with the app and auto-attached to journey emails.
 * Files live in assets/crm-parent-forms/ (git-tracked).
 */
export type TemplateFormAttachment = {
  fileName: string
  contentType: 'application/pdf'
  contentBytes: Buffer
  sizeBytes: number
}

const FORM_DIR = path.join(process.cwd(), 'assets', 'crm-parent-forms')

/** Display names as attached on the email. */
const TEMPLATE_FORMS: Partial<Record<CommTemplate, { file: string; fileName: string }[]>> =
  {
    WELCOME: [
      { file: 'WelcomePacket.pdf', fileName: 'WelcomePacket.pdf' },
    ],
    CONSENT_REQUEST: [
      { file: 'IntakeForm.pdf', fileName: 'IntakeForm.pdf' },
      { file: 'ConsentForm.pdf', fileName: 'ConsentForm.pdf' },
    ],
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
    const full = path.join(FORM_DIR, spec.file)
    if (!fs.existsSync(full)) {
      console.error(`[crm-email] missing template form: ${full}`)
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

/** Lightweight meta for preview HTML strip (no need to read full bytes twice if already loaded). */
export function templateFormAttachmentMetas(
  template: CommTemplate
): { fileName: string; sizeBytes: number }[] {
  const specs = templateFormSpecs(template)
  return specs.map((spec) => {
    const full = path.join(FORM_DIR, spec.file)
    let sizeBytes = 0
    try {
      sizeBytes = fs.statSync(full).size
    } catch {
      sizeBytes = 0
    }
    return { fileName: spec.fileName, sizeBytes }
  })
}
