import { describe, expect, it } from 'vitest'
import {
  buildContentDisposition,
  parseContentDispositionFileName,
  sanitizeAsciiFileName,
} from './contentDisposition'

describe('lib/http/contentDisposition', () => {
  it('sanitizes narrow no-break spaces from macOS screenshot names', () => {
    const name = 'Screenshot 2026-08-27 at 7.17.45\u202FPM.png'
    expect(sanitizeAsciiFileName(name)).toBe('Screenshot 2026-08-27 at 7.17.45 PM.png')
  })

  it('builds filename* when the original name is not ASCII-safe', () => {
    const name = 'ConsentForm — 1.pdf'
    const header = buildContentDisposition('attachment', name)
    expect(header).toContain('filename="ConsentForm _ 1.pdf"')
    expect(header).toContain("filename*=UTF-8''")
    expect(header).toContain(encodeURIComponent(name))
  })

  it('uses a simple filename parameter for plain ASCII names', () => {
    expect(buildContentDisposition('inline', 'Insurance Card.pdf')).toBe(
      'inline; filename="Insurance Card.pdf"'
    )
  })

  it('round-trips filename* values', () => {
    const name = 'Screenshot 2026-08-27 at 7.17.45\u202FPM.png'
    const header = buildContentDisposition('attachment', name)
    expect(parseContentDispositionFileName(header)).toBe(name)
  })
})
