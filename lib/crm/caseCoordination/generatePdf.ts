import 'server-only'

import fs from 'fs'
import path from 'path'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import {
  CASE_COORDINATION_BILLING_GUIDELINES,
  CASE_COORDINATION_CLINICAL_COMPLIANCE,
  CASE_COORDINATION_CONTACT_EMAIL,
  CASE_COORDINATION_CONTACT_PROMPT,
  CASE_COORDINATION_INTRO,
  CASE_COORDINATION_POLICY_INTRO,
  CASE_COORDINATION_POLICY_ITEMS,
  CASE_COORDINATION_TAGLINE,
} from '@/lib/crm/caseCoordination/boilerplate'
import type { CaseCoordinationDocumentPayload } from '@/lib/crm/caseCoordination/resolve'

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 48
const CONTENT_W = PAGE_W - MARGIN * 2
const ORANGE = rgb(231 / 255, 105 / 255, 44 / 255)
const CYAN = rgb(13 / 255, 148 / 255, 136 / 255)
const INK = rgb(42 / 255, 32 / 255, 25 / 255)
const MUTED = rgb(107 / 255, 94 / 255, 84 / 255)
const WHITE = rgb(1, 1, 1)

type Fonts = { bold: PDFFont; body: PDFFont }

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

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
      const w = 52
      const h = (img.height / img.width) * w
      const y = yTop - h
      page.drawImage(img, { x: MARGIN, y, width: w, height: h })
      return y - 8
    } catch {
      continue
    }
  }
  return yTop
}

type PageCtx = {
  pdf: PDFDocument
  page: PDFPage
  y: number
  fonts: Fonts
}

function ensureSpace(ctx: PageCtx, needed: number): void {
  if (ctx.y - needed >= MARGIN + 24) return
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H])
  ctx.y = PAGE_H - MARGIN
}

function drawParagraph(ctx: PageCtx, text: string, size = 10, gap = 14): void {
  const lines = wrapText(text, ctx.fonts.body, size, CONTENT_W)
  for (const line of lines) {
    ensureSpace(ctx, gap)
    ctx.page.drawText(line, {
      x: MARGIN,
      y: ctx.y,
      size,
      font: ctx.fonts.body,
      color: INK,
    })
    ctx.y -= gap
  }
  ctx.y -= 4
}

function drawSectionBand(ctx: PageCtx, title: string, color: typeof ORANGE): void {
  ensureSpace(ctx, 28)
  ctx.y -= 6
  const bandH = 22
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - bandH + 6,
    width: CONTENT_W,
    height: bandH,
    color,
  })
  ctx.page.drawText(title, {
    x: MARGIN + 10,
    y: ctx.y - 12,
    size: 10,
    font: ctx.fonts.bold,
    color: WHITE,
  })
  ctx.y -= bandH + 8
}

function drawField(ctx: PageCtx, label: string, value: string): void {
  ensureSpace(ctx, 16)
  ctx.page.drawText(label, {
    x: MARGIN,
    y: ctx.y,
    size: 9,
    font: ctx.fonts.bold,
    color: INK,
  })
  const valueLines = wrapText(value, ctx.fonts.body, 9, CONTENT_W - 170)
  let valueY = ctx.y
  for (const line of valueLines) {
    ctx.page.drawText(line, {
      x: MARGIN + 170,
      y: valueY,
      size: 9,
      font: ctx.fonts.body,
      color: INK,
    })
    valueY -= 12
  }
  ctx.y = Math.min(ctx.y - 14, valueY - 2)
}

function drawBtTable(ctx: PageCtx, document: CaseCoordinationDocumentPayload): void {
  const cols = [120, 115, 155, 70]
  const headers = ['Behavior Technician', 'Phone/Email', 'Schedule', 'Start Date']
  const rows =
    document.behaviorTechnicians.length > 0
      ? document.behaviorTechnicians.map((r) => [
          r.behaviorTechnician,
          r.phoneEmail ?? '—',
          r.schedule ?? '—',
          r.startDate ?? '—',
        ])
      : [['Not yet assigned', '', '', '']]

  ensureSpace(ctx, 40)
  let x = MARGIN
  for (let i = 0; i < headers.length; i++) {
    ctx.page.drawRectangle({
      x,
      y: ctx.y - 16,
      width: cols[i],
      height: 18,
      color: rgb(230 / 255, 247 / 255, 245 / 255),
      borderColor: rgb(216 / 255, 208 / 255, 200 / 255),
      borderWidth: 0.5,
    })
    ctx.page.drawText(headers[i], {
      x: x + 4,
      y: ctx.y - 12,
      size: 7.5,
      font: ctx.fonts.bold,
      color: INK,
    })
    x += cols[i]
  }
  ctx.y -= 20

  for (const row of rows) {
    ensureSpace(ctx, 36)
    let rowHeight = 18
    const cellLines = row.map((cell, i) =>
      wrapText(cell, ctx.fonts.body, 8, cols[i] - 8)
    )
    rowHeight = Math.max(18, ...cellLines.map((lines) => lines.length * 11 + 6))

    x = MARGIN
    for (let i = 0; i < row.length; i++) {
      ctx.page.drawRectangle({
        x,
        y: ctx.y - rowHeight,
        width: cols[i],
        height: rowHeight,
        borderColor: rgb(216 / 255, 208 / 255, 200 / 255),
        borderWidth: 0.5,
      })
      let lineY = ctx.y - 12
      for (const line of cellLines[i]) {
        ctx.page.drawText(line, {
          x: x + 4,
          y: lineY,
          size: 8,
          font: ctx.fonts.body,
          color: INK,
        })
        lineY -= 11
      }
      x += cols[i]
    }
    ctx.y -= rowHeight + 2
  }
  ctx.y -= 6
}

function drawStaticBox(
  ctx: PageCtx,
  title: string,
  intro: string | null,
  bullets: readonly string[]
): void {
  ensureSpace(ctx, 60)
  ctx.page.drawText(title, {
    x: MARGIN + 4,
    y: ctx.y,
    size: 10,
    font: ctx.fonts.bold,
    color: ORANGE,
  })
  ctx.y -= 16
  if (intro) {
    drawParagraph(ctx, intro, 9, 12)
  }
  for (const item of bullets) {
    const lines = wrapText(`• ${item}`, ctx.fonts.body, 9, CONTENT_W - 12)
    for (const line of lines) {
      ensureSpace(ctx, 13)
      ctx.page.drawText(line, {
        x: MARGIN + 8,
        y: ctx.y,
        size: 9,
        font: ctx.fonts.body,
        color: INK,
      })
      ctx.y -= 13
    }
  }
  ctx.y -= 10
}

export async function generateCaseCoordinationPdf(
  document: CaseCoordinationDocumentPayload
): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const fonts: Fonts = {
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    body: await pdf.embedFont(StandardFonts.Helvetica),
  }
  const page = pdf.addPage([PAGE_W, PAGE_H])
  const ctx: PageCtx = { pdf, page, y: PAGE_H - MARGIN, fonts }

  const yTop = PAGE_H - MARGIN
  const yAfterLogo = await embedLogo(page, pdf, yTop)
  page.drawText('Rise & Shine', {
    x: MARGIN + 66,
    y: yTop - 18,
    size: 22,
    font: fonts.bold,
    color: ORANGE,
  })
  page.drawText(CASE_COORDINATION_TAGLINE, {
    x: MARGIN + 66,
    y: yTop - 34,
    size: 9,
    font: fonts.body,
    color: MUTED,
  })
  page.drawLine({
    start: { x: MARGIN, y: yTop - 44 },
    end: { x: PAGE_W - MARGIN, y: yTop - 44 },
    thickness: 2.5,
    color: ORANGE,
  })
  ctx.y = yAfterLogo - 10

  drawParagraph(ctx, CASE_COORDINATION_INTRO)

  drawSectionBand(ctx, 'CLIENT INFORMATION', ORANGE)
  drawField(ctx, 'Client Name:', document.clientName)
  drawField(ctx, 'Service Address:', document.serviceAddress)
  drawField(ctx, 'Start Date:', document.startDate?.trim() ? document.startDate : '—')
  drawField(ctx, 'Parent/Guardian Name:', document.parentGuardianName)
  drawField(ctx, 'Parent Email Address:', document.parentEmail)
  drawField(ctx, 'Parent Contact Number:', document.parentContactNumber)

  drawSectionBand(ctx, 'SUPERVISING BCBA INFORMATION', ORANGE)
  drawField(ctx, 'BCBA Name:', document.bcbaName)
  drawField(ctx, 'Contact Number:', document.bcbaContactNumber)
  drawField(ctx, 'Email Address:', document.bcbaEmail)

  drawSectionBand(ctx, 'BEHAVIOR TECHNICIAN INFORMATION', CYAN)
  drawBtTable(ctx, document)

  drawSectionBand(ctx, 'CASE COORDINATOR INFORMATION', ORANGE)
  drawField(ctx, 'Name:', document.coordinatorName)
  drawField(ctx, 'Contact Number:', document.coordinatorContactNumber)
  drawField(ctx, 'Email Address:', document.coordinatorEmail)

  drawStaticBox(ctx, 'BILLING & SESSION GUIDELINES', null, CASE_COORDINATION_BILLING_GUIDELINES)
  drawStaticBox(ctx, 'POLICY REMINDER', CASE_COORDINATION_POLICY_INTRO, CASE_COORDINATION_POLICY_ITEMS)
  drawStaticBox(ctx, 'CLINICAL COMPLIANCE STATEMENT', CASE_COORDINATION_CLINICAL_COMPLIANCE, [])
  drawParagraph(
    ctx,
    `${CASE_COORDINATION_CONTACT_PROMPT} ${CASE_COORDINATION_CONTACT_EMAIL}`,
    9,
    12
  )

  ensureSpace(ctx, 20)
  ctx.page.drawText('Confirmed case coordination record — snapshot frozen at sign-off.', {
    x: MARGIN,
    y: ctx.y,
    size: 8,
    font: fonts.body,
    color: MUTED,
  })

  return Buffer.from(await pdf.save())
}
