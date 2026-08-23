import type { CommTemplate } from '@prisma/client'
import type { StaffEmailContent, StaffMergeFields } from './types'
import { COMPANY_EMAIL, childName, greeting, para, staffSignature } from './shell'

/** Legacy template + MANUAL fallback. */
export const LEGACY_RENDERERS: Partial<
  Record<CommTemplate, (f: StaffMergeFields) => StaffEmailContent>
> = {
  /** Kept for historical sends; not offered in compose UI. */
  CC_INTRODUCTION: (f) => {
    const child = childName(f)
    const coord = f.coordinatorName?.trim()
    return {
      subject: `Meet your case coordinator for ${child}`,
      bodyHtml: `
        ${para(greeting(f))}
        ${para(
          coord
            ? `We&apos;re glad to introduce <strong>${coord}</strong>, who will help coordinate care for ${child}.`
            : `We&apos;re assigning a case coordinator to help guide ${child}&apos;s care.`
        )}
        ${para(`They&apos;ll be in touch about next steps. Reply anytime with questions.`)}
        ${staffSignature(f)}
      `,
    }
  },

  CASE_COORDINATION_FORM: (f) => {
    const child = childName(f)
    return {
      subject: `Case coordination forms for ${child}`,
      bodyHtml: `
        ${para(greeting(f))}
        ${para(`Please review and complete the case coordination forms so we can finalize ${child}&apos;s care plan.`)}
        ${para(`If a form is attached, fill in the highlighted sections and reply when you&apos;re finished. We&apos;re here if anything is unclear.`)}
      `,
    }
  },

  MANUAL: (f) => {
    const child = childName(f)
    return {
      subject: `Update regarding ${child}`,
      bodyHtml: `
        ${para(greeting(f))}
        ${para(`We wanted to reach out regarding ${child}. Please see the message below, and reply if you have questions.`)}
        ${staffSignature(f)}
      `,
    }
  },
}
