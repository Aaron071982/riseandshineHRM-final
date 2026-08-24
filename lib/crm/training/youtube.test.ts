import { describe, expect, it } from 'vitest'
import { extractYoutubeVideoId } from './youtube'

describe('extractYoutubeVideoId', () => {
  it('parses watch?v= URLs', () => {
    expect(
      extractYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    ).toBe('dQw4w9WgXcQ')
    expect(
      extractYoutubeVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ&t=30')
    ).toBe('dQw4w9WgXcQ')
  })

  it('parses youtu.be short links', () => {
    expect(extractYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ'
    )
  })

  it('parses shorts and embed URLs', () => {
    expect(
      extractYoutubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')
    ).toBe('dQw4w9WgXcQ')
    expect(
      extractYoutubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')
    ).toBe('dQw4w9WgXcQ')
  })

  it('rejects invalid input', () => {
    expect(extractYoutubeVideoId('not a url')).toBeNull()
    expect(extractYoutubeVideoId('https://example.com/watch?v=abc')).toBeNull()
    expect(extractYoutubeVideoId('')).toBeNull()
  })
})
