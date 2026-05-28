'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { rbtOnboardingPdfUrl } from '@/lib/onboarding/pdf'
import { loadPdfJs } from '@/lib/onboarding/load-pdfjs'

type Props = {
  documentId: string
  pdfUrl?: string | null
  title: string
  onScrolledToBottom?: () => void
  className?: string
}

export default function OnboardingPdfViewer({
  documentId,
  pdfUrl,
  title,
  onScrolledToBottom,
  className = '',
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const bottomReachedRef = useRef(false)
  const objectUrlRef = useRef<string | null>(null)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || bottomReachedRef.current) return
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24
    if (atBottom) {
      bottomReachedRef.current = true
      onScrolledToBottom?.()
    }
  }, [onScrolledToBottom])

  useEffect(() => {
    bottomReachedRef.current = false
    let cancelled = false
    async function render() {
      setLoading(true)
      setError(null)
      setEmbedUrl(null)
      try {
        const url = pdfUrl || rbtOnboardingPdfUrl(documentId)
        const res = await fetch(url, { credentials: 'include' })
        if (!res.ok) {
          setError('PDF not available')
          setLoading(false)
          return
        }
        const buf = await res.arrayBuffer()
        const data = new Uint8Array(buf)

        try {
          const pdfjsLib = await loadPdfJs()
          const pdf = await pdfjsLib.getDocument({ data }).promise
          if (cancelled) return
          setPageCount(pdf.numPages)
          const container = scrollRef.current
          if (!container) return
          container.innerHTML = ''
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const viewport = page.getViewport({ scale: 1.2 })
            const canvas = document.createElement('canvas')
            canvas.width = viewport.width
            canvas.height = viewport.height
            canvas.className = 'mx-auto mb-4 shadow-sm block max-w-full'
            const ctx = canvas.getContext('2d')
            if (!ctx) continue
            await page.render({ canvasContext: ctx, viewport, canvas } as Parameters<typeof page.render>[0])
              .promise
            container.appendChild(canvas)
          }
          requestAnimationFrame(checkScroll)
        } catch (pdfJsErr) {
          console.warn('[OnboardingPdfViewer] PDF.js failed, using embed fallback', pdfJsErr)
          if (cancelled) return
          if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
          objectUrlRef.current = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }))
          setEmbedUrl(objectUrlRef.current)
          setPageCount(1)
        }
      } catch (e) {
        console.error('[OnboardingPdfViewer]', e)
        if (!cancelled) setError('Failed to load PDF')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    render()
    return () => {
      cancelled = true
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [documentId, pdfUrl, checkScroll])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      ro.disconnect()
    }
  }, [checkScroll, pageCount, embedUrl])

  return (
    <div className={`relative border rounded-lg bg-white dark:bg-slate-900 ${className}`}>
      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading document…
        </div>
      )}
      {error && <p className="p-6 text-red-600 text-sm">{error}</p>}
      {embedUrl && !loading && !error && (
        <p className="text-xs text-amber-700 bg-amber-50 border-b border-amber-200 px-3 py-2">
          Scroll through the full document below, then confirm you have read it.
        </p>
      )}
      <div
        ref={scrollRef}
        className="overflow-auto max-h-[min(600px,70vh)] touch-pan-y p-2"
        style={{ display: loading || error ? 'none' : 'block' }}
        aria-label={title}
      >
        {embedUrl ? (
          <object
            data={embedUrl}
            type="application/pdf"
            className="w-full min-h-[2400px]"
            aria-label={title}
          >
            <iframe src={embedUrl} title={title} className="w-full min-h-[2400px] border-0" />
          </object>
        ) : null}
      </div>
    </div>
  )
}
