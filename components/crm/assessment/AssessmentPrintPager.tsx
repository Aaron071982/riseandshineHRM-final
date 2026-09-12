'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  clientId: string
  assessmentId: string
  clientName: string
  children: React.ReactNode
}

/**
 * Runs Paged.js over the assessment print source so @page margin boxes and
 * counter(pages) work, then allows Save-as-PDF / optional ?auto=1 print.
 */
export function AssessmentPrintPager({
  clientId,
  assessmentId,
  clientName,
  children,
}: Props) {
  const sourceRef = useRef<HTMLDivElement>(null)
  const renderRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('Preparing paginated layout…')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const previousTitle = document.title
    const safe = clientName.replace(/\s+/g, ' ').trim() || 'Client'
    document.title = `${safe} Assessment`
    return () => {
      document.title = previousTitle
    }
  }, [clientName])

  useEffect(() => {
    let cancelled = false

    async function waitForImages(root: HTMLElement) {
      const imgs = Array.from(root.querySelectorAll('img'))
      await Promise.all(
        imgs.map(
          (img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  img.addEventListener('load', () => resolve(), { once: true })
                  img.addEventListener('error', () => resolve(), { once: true })
                })
        )
      )
    }

    async function run() {
      const source = sourceRef.current
      const renderTo = renderRef.current
      if (!source || !renderTo) return

      try {
        if (document.fonts?.ready) {
          await document.fonts.ready
        }
        await waitForImages(source)
        if (cancelled) return

        const { Previewer } = await import('pagedjs')
        if (cancelled) return

        // Clone so React can keep ownership of `source` after setState.
        const clone = source.cloneNode(true) as HTMLElement
        source.classList.add('is-paged')
        renderTo.innerHTML = ''
        const previewer = new Previewer()
        // Omit stylesheets so Paged.js reads document.styleSheets (Next CSS).
        const flow = await previewer.preview(clone, undefined, renderTo)
        if (cancelled) return

        setStatus(
          typeof flow?.total === 'number'
            ? `Ready · ${flow.total} page${flow.total === 1 ? '' : 's'}`
            : 'Ready'
        )
        setReady(true)

        const params = new URLSearchParams(window.location.search)
        if (params.get('auto') === '1') {
          window.setTimeout(() => {
            if (!cancelled) window.print()
          }, 250)
        }
      } catch (err) {
        console.error('[assessment-print] pagedjs', err)
        if (cancelled) return
        source.classList.remove('is-paged')
        setFailed(true)
        setStatus(
          'Paged layout failed — you can still print, but page numbers may be wrong.'
        )
        setReady(true)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <div className="assessment-print-toolbar no-print">
        <p className="print-hint">
          {status}
          {!failed && (
            <>
              {' '}
              Enable <strong>Background graphics</strong> in the print dialog so
              orange headers and charts print correctly.
            </>
          )}
        </p>
        <div className="toolbar-actions">
          <button type="button" disabled={!ready} onClick={() => window.print()}>
            {ready ? 'Save as PDF / Print' : 'Preparing…'}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              window.open(
                `/client-services/clients/${clientId}/assessments/${assessmentId}`,
                '_self'
              )
            }
          >
            Back to form
          </button>
        </div>
      </div>

      <div ref={renderRef} className="assessment-print-render" />
      <div ref={sourceRef} className="assessment-print-source">
        {children}
      </div>
    </>
  )
}
