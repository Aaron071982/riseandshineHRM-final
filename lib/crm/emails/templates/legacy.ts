import type { CommTemplate } from '@prisma/client'
import type { StaffEmailContent, StaffMergeFields } from './types'
import { COMPANY_EMAIL, childName, greeting, para, staffSignature } from './shell'

/** Legacy template + MANUAL fallback. */
export const LEGACY_RENDERERS: Partial<
  Record<CommTemplate, (f: StaffMergeFields) => StaffEmailContent>
> = {
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
