import 'server-only'

import fs from 'fs'
import path from 'path'
import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib'
import type { AssessmentArtifactType } from '@prisma/client'
import { ASSESSMENT_ARTIFACT_LABELS } from '@/lib/crm/clinicalAssessment/artifacts.shared'

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 48
const BRAND = rgb(227 / 255, 111 / 255, 30 / 255)
const MUTED = rgb(0.35, 0.35, 0.35)

async function embedLogo(page: PDFPage, pdf: PDFDocument, yTop: number): Promise<number> {
  const logoPaths = [
    path.join(process.cwd(), 'public', 'new-real-logo.png'),
    path.join(process.cwd(), 'public', 'logo.png'),
  ]
  for (const logoPath of logoPaths) {
    try {
      if (!fs.existsSync(logoPath)) continue
      const bytes = fs.readFileSync(logoPath)
      const img = logoPath.endsWith('.png')
        ? await pdf.embedPng(bytes)
        : await pdf.embedJpg(bytes)
      const w = 72
      const h = (img.height / img.width) * w
      const y = yTop - h
      page.drawImage(img, { x: MARGIN, y, width: w, height: h })
      return y - 12
    } catch {
      continue
    }
  }
  return yTop
}

async function drawBrandedHeader(
  page: PDFPage,
  pdf: PDFDocument,
  lines: { artifactLabel: string; clientCode: string; versionNumber: number }
): Promise<number> {
  const yAfterLogo = await embedLogo(page, pdf, PAGE_H - MARGIN)
  const font = await pdf.embedFont(StandardFonts.HelveticaBold)
  const body = await pdf.embedFont(StandardFonts.Helvetica)
  page.drawText('Rise & Shine ABA', {
    x: MARGIN + 84,
    y: PAGE_H - MARGIN - 14,
    size: 14,
    font,
    color: BRAND,
  })
  page.drawText('Clinical Assessment Record', {
    x: MARGIN + 84,
    y: PAGE_H - MARGIN - 30,
    size: 10,
    font: body,
    color: MUTED,
  })
  page.drawText(
    `${lines.artifactLabel} · Client ${lines.clientCode} · v${lines.versionNumber}`,
    {
      x: MARGIN,
      y: yAfterLogo - 8,
      size: 9,
      font: body,
      color: MUTED,
    }
  )
  page.drawLine({
    start: { x: MARGIN, y: yAfterLogo - 16 },
    end: { x: PAGE_W - MARGIN, y: yAfterLogo - 16 },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  })
  return yAfterLogo - 28
}

function drawBrandedFooter(
  page: PDFPage,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>
) {
  const stamp = new Date().toISOString().slice(0, 10)
  page.drawText(`Confidential clinical record · Rise & Shine ABA · ${stamp}`, {
    x: MARGIN,
    y: 28,
    size: 8,
    font,
    color: MUTED,
  })
}

function isPdfContent(contentType: string, bytes: Buffer): boolean {
  const t = contentType.toLowerCase()
  if (t.includes('pdf')) return true
  return bytes.length >= 4 && bytes.subarray(0, 4).toString() === '%PDF'
}

function isImageContent(contentType: string): boolean {
  return contentType.toLowerCase().startsWith('image/')
}

export async function wrapClinicalAssessmentDownload(input: {
  bytes: Buffer
  contentType: string
  artifactType: AssessmentArtifactType
  clientCode: string
  versionNumber: number
  branded?: boolean
}): Promise<{ bytes: Buffer; contentType: string }> {
  if (!input.branded) {
    return { bytes: input.bytes, contentType: input.contentType }
  }

  const wrapper = await PDFDocument.create()
  const bodyFont = await wrapper.embedFont(StandardFonts.Helvetica)
  const artifactLabel = ASSESSMENT_ARTIFACT_LABELS[input.artifactType]

  if (isPdfContent(input.contentType, input.bytes)) {
    const source = await PDFDocument.load(input.bytes, { ignoreEncryption: true })
    const copied = await wrapper.copyPages(source, source.getPageIndices())
    const cover = wrapper.addPage([PAGE_W, PAGE_H])
    await drawBrandedHeader(cover, wrapper, {
      artifactLabel,
      clientCode: input.clientCode,
      versionNumber: input.versionNumber,
    })
    drawBrandedFooter(cover, bodyFont)
    for (const page of copied) {
      wrapper.addPage(page)
    }
  } else if (isImageContent(input.contentType)) {
    const page = wrapper.addPage([PAGE_W, PAGE_H])
    const contentTop = await drawBrandedHeader(page, wrapper, {
      artifactLabel,
      clientCode: input.clientCode,
      versionNumber: input.versionNumber,
    })
    const lower = input.contentType.toLowerCase()
    let img
    try {
      img = lower.includes('png')
        ? await wrapper.embedPng(input.bytes)
        : await wrapper.embedJpg(input.bytes)
    } catch {
      img = await wrapper.embedPng(input.bytes)
    }
    const maxW = PAGE_W - MARGIN * 2
    const maxH = contentTop - MARGIN - 40
    const scale = Math.min(maxW / img.width, maxH / img.height, 1)
    const w = img.width * scale
    const h = img.height * scale
    page.drawImage(img, {
      x: (PAGE_W - w) / 2,
      y: contentTop - h - 12,
      width: w,
      height: h,
    })
    drawBrandedFooter(page, bodyFont)
  } else {
    const page = wrapper.addPage([PAGE_W, PAGE_H])
    await drawBrandedHeader(page, wrapper, {
      artifactLabel,
      clientCode: input.clientCode,
      versionNumber: input.versionNumber,
    })
    page.drawText('Attached clinical document.', {
      x: MARGIN,
      y: PAGE_H / 2,
      size: 11,
      font: bodyFont,
      color: MUTED,
    })
    drawBrandedFooter(page, bodyFont)
  }

  const out = await wrapper.save()
  return { bytes: Buffer.from(out), contentType: 'application/pdf' }
}
