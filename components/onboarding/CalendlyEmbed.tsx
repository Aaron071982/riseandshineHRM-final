'use client'

import { useEffect, useId, useRef } from 'react'

const CALENDLY_WIDGET_SRC = 'https://assets.calendly.com/assets/external/widget.js'

type CalendlyEmbedProps = {
  url: string
  /** Min height for the inline widget (Calendly default is ~700). */
  height?: number
  className?: string
}

declare global {
  interface Window {
    Calendly?: {
      initInlineWidget: (opts: {
        url: string
        parentElement: HTMLElement
        resize?: boolean
      }) => void
    }
  }
}

function loadCalendlyScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.Calendly) return Promise.resolve()

  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${CALENDLY_WIDGET_SRC}"]`
  )
  if (existing) {
    return new Promise((resolve) => {
      if (window.Calendly) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = CALENDLY_WIDGET_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Calendly'))
    document.body.appendChild(script)
  })
}

export default function CalendlyEmbed({
  url,
  height = 720,
  className,
}: CalendlyEmbedProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const reactId = useId()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false

    void loadCalendlyScript()
      .then(() => {
        if (cancelled || !hostRef.current || !window.Calendly) return
        hostRef.current.innerHTML = ''
        window.Calendly.initInlineWidget({
          url,
          parentElement: hostRef.current,
          resize: true,
        })
      })
      .catch(() => {
        /* iframe fallback below still works if script blocked */
      })

    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <div className={className}>
      <div
        ref={hostRef}
        data-calendly-id={reactId}
        className="calendly-inline-widget w-full overflow-hidden rounded-xl border border-gray-200 bg-white"
        style={{ minWidth: 320, height }}
      />
      <noscript>
        <iframe
          title="Schedule with Calendly"
          src={url}
          className="w-full rounded-xl border border-gray-200"
          style={{ minHeight: height }}
        />
      </noscript>
      <p className="mt-2 text-center text-xs text-gray-500">
        Having trouble?{' '}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#e36f1e] hover:underline"
        >
          Open the scheduling page
        </a>
      </p>
    </div>
  )
}
