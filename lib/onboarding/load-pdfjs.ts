/** Load PDF.js in the browser without webpack (avoids Next.js bundling errors). */
const PDFJS_VERSION = '5.4.530'

export type PdfJsModule = typeof import('pdfjs-dist')

let loadPromise: Promise<PdfJsModule> | null = null

export function loadPdfJs(): Promise<PdfJsModule> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('PDF.js is only available in the browser'))
  }
  if (!loadPromise) {
    loadPromise = import(
      /* webpackIgnore: true */
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`
    ).then((mod) => {
      const pdfjs = mod as PdfJsModule
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`
      return pdfjs
    })
  }
  return loadPromise
}
