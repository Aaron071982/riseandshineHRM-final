import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib'
import fs from 'fs'
import path from 'path'
import type { Prisma } from '@prisma/client'
import { formatUserAgentShort } from '@/lib/user-agent-short'
import { LEGAL_BASIS } from '@/lib/signature-certificate'

const PAGE_W = 612
const PAGE_H = 792
const MARGIN_L = 50
const MARGIN_R = 50
const MARGIN_TOP = 52
const MARGIN_BOTTOM = 56
const ORANGE = rgb(227 / 255, 111 / 255, 30 / 255)
const ORANGE_LIGHT = rgb(254 / 255, 243 / 255, 232 / 255)
const TEXT_MUTED = rgb(0.35, 0.35, 0.35)

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length <= maxChars) cur = next
    else {
      if (cur) lines.push(cur)
      cur = w.length > maxChars ? w.slice(0, maxChars) : w
    }
  }
  if (cur) lines.push(cur)
  return lines
}

async function tryEmbedLogo(pdf: PDFDocument, page: PDFPage, yTop: number): Promise<number> {
  const logoPaths = [
    path.join(process.cwd(), 'public', 'new-real-logo.png'),
    path.join(process.cwd(), 'public', 'logo.png'),
    path.join(process.cwd(), 'public', 'logo.jpg'),
  ]
  for (const p of logoPaths) {
    try {
      if (!fs.existsSync(p)) continue
      const bytes = fs.readFileSync(p)
      const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50
      const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8
      let img: Awaited<ReturnType<PDFDocument['embedPng']>>
      if (isPng) {
        img = await pdf.embedPng(bytes)
      } else if (isJpeg) {
        img = await pdf.embedJpg(bytes)
      } else {
        try {
          img = await pdf.embedPng(bytes)
        } catch {
          continue
        }
      }
      const w = 80
      const h = (img.height / img.width) * w
      const y = yTop - h
      page.drawImage(img, { x: MARGIN_L, y, width: w, height: h })
      return y - 16
    } catch {
      continue
    }
  }
  return yTop
}

type CertInput = {
  documentTitle: string
  documentSlug: string
  signerFullName: string
  signerEmail: string | null
  signatureText: string | null
  signatureTimestamp: Date
  signerIpAddress: string | null
  signerUserAgent: string | null
  documentHash: string
  consentStatement: string | null
  certificateGeneratedAt: Date
  certificateJson: Prisma.JsonValue
}

export async function buildCertificatePdfBytes(cert: CertInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  let page = pdf.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN_TOP

  // Brand header bar
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 44,
    width: PAGE_W,
    height: 44,
    color: ORANGE,
  })
  page.drawText('Rise & Shine — Electronic signature certificate', {
    x: MARGIN_L,
    y: PAGE_H - 30,
    size: 12,
    font: bold,
    color: rgb(1, 1, 1),
  })

  y = PAGE_H - 56
  y = await tryEmbedLogo(pdf, page, y)

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN_BOTTOM) {
      page = pdf.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - MARGIN_TOP
    }
  }

  const drawHeading = (text: string, size = 14) => {
    ensureSpace(28)
    page.drawText(text, { x: MARGIN_L, y, size, font: bold, color: rgb(0.12, 0.12, 0.12) })
    y -= size + 10
  }

  const drawLabelValue = (label: string, value: string, valueSize = 9) => {
    ensureSpace(36)
    page.drawText(label, { x: MARGIN_L, y, size: 9, font: bold, color: TEXT_MUTED })
    y -= 12
    for (const ln of wrapText(value, 82)) {
      ensureSpace(14)
      page.drawText(ln, { x: MARGIN_L, y, size: valueSize, font, color: rgb(0, 0, 0) })
      y -= valueSize + 3
    }
    y -= 8
  }

  drawHeading('Certificate of electronic signature', 16)
  page.drawRectangle({
    x: MARGIN_L - 4,
    y: y - 4,
    width: PAGE_W - MARGIN_L - MARGIN_R + 8,
    height: 22,
    color: ORANGE_LIGHT,
    borderColor: rgb(0.9, 0.85, 0.8),
    borderWidth: 0.5,
  })
  page.drawText('Electronically signed', {
    x: MARGIN_L,
    y: y - 2,
    size: 11,
    font: bold,
    color: rgb(0.08, 0.45, 0.18),
  })
  y -= 28

  const eastern = cert.signatureTimestamp.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'long',
    timeStyle: 'short',
  })
  const genAt = cert.certificateGeneratedAt.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  drawLabelValue('Document title', cert.documentTitle)
  drawLabelValue('Document slug', cert.documentSlug)
  drawLabelValue('Signer', cert.signerFullName)
  drawLabelValue('Email', cert.signerEmail ?? '—')
  drawLabelValue('Signed (America/New_York)', `${eastern} (Eastern)`)
  drawLabelValue('IP address', cert.signerIpAddress ?? '—')
  drawLabelValue('Device / browser', formatUserAgentShort(cert.signerUserAgent))
  drawLabelValue('Typed signature', cert.signatureText ?? '—')
  drawLabelValue('Document integrity (SHA-256 of PDF bytes)', cert.documentHash)

  const json = cert.certificateJson as {
    auditTrail?: unknown[]
    preCompliance?: boolean
    disclaimer?: string
    documentIntegrity?: { signingPayloadSha256?: string }
    certificateVersion?: string
  }
  const payloadHash = json?.documentIntegrity?.signingPayloadSha256
  if (payloadHash) {
    drawLabelValue('Signing payload digest', payloadHash)
  }
  if (json?.certificateVersion) {
    drawLabelValue('Certificate version', String(json.certificateVersion))
  }
  drawLabelValue('Certificate generated (Eastern)', genAt)
  drawLabelValue('Legal basis', LEGAL_BASIS)

  if (cert.consentStatement) {
    ensureSpace(24)
    page.drawText('Consent statement (agreed at signing)', {
      x: MARGIN_L,
      y,
      size: 9,
      font: bold,
      color: TEXT_MUTED,
    })
    y -= 12
    for (const ln of wrapText(cert.consentStatement, 88)) {
      ensureSpace(11)
      page.drawText(ln, { x: MARGIN_L, y, size: 8, font, color: rgb(0.15, 0.15, 0.15) })
      y -= 10
    }
    y -= 10
  }

  drawHeading('Audit trail', 12)
  if (json?.preCompliance && json?.disclaimer) {
    for (const ln of wrapText(json.disclaimer, 90)) {
      ensureSpace(11)
      page.drawText(ln, { x: MARGIN_L, y, size: 8, font, color: rgb(0.45, 0.25, 0.1) })
      y -= 10
    }
    y -= 8
  }

  const events = Array.isArray(json?.auditTrail) ? json.auditTrail : []
  if (events.length === 0) {
    ensureSpace(12)
    page.drawText('No client-side audit events recorded (e.g. pre-compliance certificate).', {
      x: MARGIN_L,
      y,
      size: 8,
      font,
      color: TEXT_MUTED,
    })
    y -= 14
  } else {
    for (const ev of events) {
      const e = ev as { action?: string; timestamp?: string }
      const ts = e.timestamp
        ? new Date(e.timestamp).toLocaleString('en-US', {
            timeZone: 'America/New_York',
            dateStyle: 'short',
            timeStyle: 'medium',
          })
        : ''
      const lineText = `${ts} — ${e.action ?? 'event'}`
      for (const ln of wrapText(lineText, 92)) {
        ensureSpace(11)
        page.drawText(ln, { x: MARGIN_L, y, size: 8, font })
        y -= 10
      }
    }
  }

  // Footer on last page
  ensureSpace(36)
  y = Math.max(MARGIN_BOTTOM + 28, y - 12)
  page.drawLine({
    start: { x: MARGIN_L, y },
    end: { x: PAGE_W - MARGIN_R, y },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.85),
  })
  y -= 14
  page.drawText('Rise & Shine · info@riseandshine.nyc · This document was generated from the HRM signature record.', {
    x: MARGIN_L,
    y,
    size: 7,
    font,
    color: TEXT_MUTED,
    maxWidth: PAGE_W - MARGIN_L - MARGIN_R,
  })

  return pdf.save()
}
