import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawnSync } from 'child_process'
import chromium from '@sparticuz/chromium-min'
import puppeteer, { type Browser } from 'puppeteer-core'
import {
  buildPayStubHtml,
  type PayStubPayload,
} from '@/lib/payroll/payStubHtml'

/** Default pack matching @sparticuz/chromium-min@147 (Vercel = linux x64). */
export const DEFAULT_CHROMIUM_PACK_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v147.0.2/chromium-v147.0.2-pack.x64.tar'

function localChromePath(): string | null {
  const fromEnv = process.env.CHROMIUM_EXECUTABLE_PATH?.trim()
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv

  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

function isServerless(): boolean {
  return Boolean(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.VERCEL ||
      process.env.VERCEL_ENV
  )
}

async function launchServerlessBrowser(): Promise<Browser> {
  const packUrl =
    process.env.CHROMIUM_PACK_URL?.trim() || DEFAULT_CHROMIUM_PACK_URL
  chromium.setGraphicsMode = false
  const executablePath = await chromium.executablePath(packUrl)
  return puppeteer.launch({
    args: puppeteer.defaultArgs({
      args: chromium.args,
      headless: 'shell',
    }),
    defaultViewport: { width: 816, height: 1056, deviceScaleFactor: 1 },
    executablePath,
    headless: 'shell',
  })
}

/** Local: Chrome --print-to-pdf (avoids puppeteer WS flakiness on macOS CI/dev). */
function renderWithChromeCli(html: string, chromePath: string): Buffer {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paystub-'))
  const htmlPath = path.join(dir, 'stub.html')
  const pdfPath = path.join(dir, 'stub.pdf')
  try {
    fs.writeFileSync(htmlPath, html, 'utf8')
    const result = spawnSync(
      chromePath,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-pdf-header-footer',
        '--print-to-pdf-no-header',
        `--print-to-pdf=${pdfPath}`,
        `file://${htmlPath}`,
      ],
      { encoding: 'utf8', timeout: 60_000 }
    )
    if (result.status !== 0 || !fs.existsSync(pdfPath)) {
      throw new Error(
        `Chrome print-to-pdf failed: ${result.stderr || result.stdout || result.error?.message}`
      )
    }
    return fs.readFileSync(pdfPath)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

async function renderWithPuppeteer(html: string): Promise<Buffer> {
  const browser = await launchServerlessBrowser()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: true,
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close().catch(() => undefined)
  }
}

/** Embed logo as data URL so headless Chrome does not need network/file access. */
export function loadPayStubLogoDataUrl(): string {
  const logoPath = path.join(
    process.cwd(),
    'public',
    'brand',
    'rise-and-shine-logo.png'
  )
  const bytes = fs.readFileSync(logoPath)
  return `data:image/png;base64,${bytes.toString('base64')}`
}

/**
 * Render a letter-size PDF from the pay stub HTML template.
 * - Vercel/Lambda: puppeteer-core + @sparticuz/chromium-min
 * - Local: Chrome/Chromium --print-to-pdf CLI
 */
export async function renderPayStubPdf(
  payload: Omit<PayStubPayload, 'logoSrc'> & { logoSrc?: string }
): Promise<Buffer> {
  const html = buildPayStubHtml({
    ...payload,
    logoSrc: payload.logoSrc ?? loadPayStubLogoDataUrl(),
  })

  if (isServerless()) {
    return renderWithPuppeteer(html)
  }

  const chromePath = localChromePath()
  if (!chromePath) {
    throw new Error(
      'No local Chrome found. Set CHROMIUM_EXECUTABLE_PATH or install Google Chrome.'
    )
  }
  return renderWithChromeCli(html, chromePath)
}

/** Dev helper: write PDF to a temp path (not used in production). */
export async function renderPayStubPdfToTemp(
  payload: Omit<PayStubPayload, 'logoSrc'> & { logoSrc?: string }
): Promise<string> {
  const buf = await renderPayStubPdf(payload)
  const out = path.join(os.tmpdir(), `pay-stub-${Date.now()}.pdf`)
  fs.writeFileSync(out, buf)
  return out
}
