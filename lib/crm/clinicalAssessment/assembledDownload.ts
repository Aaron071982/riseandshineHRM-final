import 'server-only'

import fs from 'fs'
import path from 'path'
import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib'
import type { AssessmentArtifactType } from '@prisma/client'
import { ASSESSMENT_ARTIFACT_LABELS } from '@/lib/crm/clinicalAssessment/artifacts.shared'
import {
  formatDetailDate,
  type AssessmentDetailsRecord,
} from '@/lib/crm/clinicalAssessment/details.shared'
import { downloadClinicalAssessmentArtifact } from '@/lib/crm/clinicalAssessment/storage'

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 48
const BRAND = rgb(227 / 255, 111 / 255, 30 / 255)
const MUTED = rgb(0.35, 0.35, 0.35)
const BODY = rgb(0.15, 0.15, 0.15)

export const GRAPH_ARTIFACT_TYPES: AssessmentArtifactType[] = [
  'VINELAND_3',
  'ATEC',
  'FAST',
]

type ArtifactRow = {
  artifactType: AssessmentArtifactType
  storagePath: string
  contentType: string
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
  clientCode: string,
  versionNumber: number
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
  page.drawText('Clinical Assessment Summary', {
    x: MARGIN + 84,
    y: PAGE_H - MARGIN - 30,
    size: 10,
    font: body,
    color: MUTED,
  })
  page.drawText(`Client ${clientCode} · Assessment v${versionNumber}`, {
    x: MARGIN,
    y: yAfterLogo - 8,
    size: 9,
    font: body,
    color: MUTED,
  })
  page.drawLine({
    start: { x: MARGIN, y: yAfterLogo - 16 },
    end: { x: PAGE_W - MARGIN, y: yAfterLogo - 16 },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  })
  return yAfterLogo - 28
}

function drawFooter(page: PDFPage, font: Awaited<ReturnType<PDFDocument['embedFont']>>) {
  const stamp = new Date().toISOString().slice(0, 10)
  page.drawText(`Confidential clinical record · Rise & Shine ABA · ${stamp}`, {
    x: MARGIN,
    y: 28,
    size: 8,
    font,
    color: MUTED,
  })
}

function line(
  label: string,
  value: string | null | undefined
): { label: string; value: string } | null {
  const v = value?.trim()
  if (!v) return null
  return { label, value: v }
}

function buildSummaryLines(details: AssessmentDetailsRecord | null): string[] {
  if (!details) return ['No key-details snapshot entered.']
  const rows: string[] = []

  const pushSection = (title: string, pairs: ({ label: string; value: string } | null)[]) => {
    const items = pairs.filter(Boolean) as { label: string; value: string }[]
    if (!items.length) return
    rows.push(`— ${title} —`)
    for (const p of items) {
      rows.push(`${p.label}: ${p.value}`)
    }
    rows.push('')
  }

  if (details.riskFactors.length || details.riskFactorsOther) {
    rows.push('— Safety flags —')
    if (details.riskFactors.length) {
      rows.push(`Risk factors: ${details.riskFactors.join(', ')}`)
    }
    if (details.riskFactorsOther?.trim()) {
      rows.push(`Other: ${details.riskFactorsOther.trim()}`)
    }
    rows.push('')
  }

  pushSection('Client & diagnosis', [
    line('Patient', details.patientName),
    line('DOB', formatDetailDate(details.dob)),
    line('Age', details.age),
    line('Diagnosis', details.diagnosis),
    line('Comorbid', details.comorbidDiagnosis),
    line('Report date', formatDetailDate(details.reportDate)),
    line('Assessor', details.assessorName),
    line('Credentials', details.assessorCredentials),
    line('Referring provider', details.referringProvider),
    line('NPI', details.npi),
  ])

  pushSection('Services requested', [
    line('97151 (assessment)', details.hrs97151),
    line('97153 direct/wk', details.hrs97153),
    line('97155 supervision/wk', details.hrs97155),
    line('97156', details.hrs97156),
    line('97157', details.hrs97157),
    line('Service period', details.servicePeriod),
    details.locations.length
      ? line('Locations', details.locations.join(', '))
      : null,
  ])

  pushSection('Clinical snapshot', [
    line('Reason', details.reasonForAssessment),
    line('Interfering behaviors', details.interferingBehaviors),
    line('Target behavior 1', details.targetBehavior1),
    line('Target behavior 2', details.targetBehavior2),
    line('Target behavior 3', details.targetBehavior3),
    line('Medications', details.medications),
    line('Allergies', details.allergies),
    line('Reassessment date', formatDetailDate(details.reassessmentDate)),
  ])

  pushSection('Instruments', [
    line('Vineland date', formatDetailDate(details.vinelandDate)),
    line('Vineland comm', details.vinelandCommScore),
    line('Vineland social', details.vinelandSocScore),
    line('ATEC date', formatDetailDate(details.atecDate)),
    line('FAST date', formatDetailDate(details.fastDate)),
  ])

  if (details.goalAreas.length) {
    pushSection('Goals overview', [line('Goal areas', details.goalAreas.join(', '))])
  }

  pushSection('Care team', [
    line('Speech', details.speech),
    line('OT', details.ot),
    line('PT', details.pt),
    line('Teacher', details.teacher),
    line('PCP', details.pcp),
  ])

  pushSection('Sign-off', [
    line('BCBA', details.bcbaName),
    line('BCBA date', formatDetailDate(details.bcbaDate)),
    line('Parent', details.parentName),
    line('Parent date', formatDetailDate(details.parentDate)),
  ])

  return rows.length ? rows : ['No key-details snapshot entered.']
}

async function drawSummaryPages(
  pdf: PDFDocument,
  lines: string[],
  clientCode: string,
  versionNumber: number
) {
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)
  let page = pdf.addPage([PAGE_W, PAGE_H])
  let y = await drawBrandedHeader(page, pdf, clientCode, versionNumber)
  drawFooter(page, bodyFont)

  for (const raw of lines) {
    const isSection = raw.startsWith('— ')
    const size = isSection ? 11 : 10
    const font = isSection ? boldFont : bodyFont
    const lineHeight = isSection ? 18 : 14
    if (y < MARGIN + 40) {
      page = pdf.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - MARGIN
      drawFooter(page, bodyFont)
    }
    page.drawText(raw, {
      x: MARGIN,
      y,
      size,
      font,
      color: isSection ? BRAND : BODY,
      maxWidth: PAGE_W - MARGIN * 2,
    })
    y -= lineHeight
  }
}

async function appendGraphPages(
  pdf: PDFDocument,
  artifacts: ArtifactRow[],
  clientCode: string,
  versionNumber: number
) {
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica)
  for (const type of GRAPH_ARTIFACT_TYPES) {
    const artifact = artifacts.find((a) => a.artifactType === type)
    if (!artifact) continue
    const { bytes, contentType } = await downloadClinicalAssessmentArtifact(
      artifact.storagePath
    )
    const page = pdf.addPage([PAGE_W, PAGE_H])
    const contentTop = await drawBrandedHeader(page, pdf, clientCode, versionNumber)
    page.drawText(ASSESSMENT_ARTIFACT_LABELS[type], {
      x: MARGIN,
      y: contentTop - 4,
      size: 11,
      font: bodyFont,
      color: BODY,
    })
    const lower = contentType.toLowerCase()
    let img
    try {
      img = lower.includes('png')
        ? await pdf.embedPng(bytes)
        : await pdf.embedJpg(bytes)
    } catch {
      try {
        img = await pdf.embedPng(bytes)
      } catch {
        continue
      }
    }
    const maxW = PAGE_W - MARGIN * 2
    const maxH = contentTop - MARGIN - 56
    const scale = Math.min(maxW / img.width, maxH / img.height, 1)
    const w = img.width * scale
    const h = img.height * scale
    page.drawImage(img, {
      x: (PAGE_W - w) / 2,
      y: contentTop - h - 24,
      width: w,
      height: h,
    })
    drawFooter(page, bodyFont)
  }
}

async function appendPdfArtifact(
  pdf: PDFDocument,
  artifact: ArtifactRow
): Promise<void> {
  const { bytes, contentType } = await downloadClinicalAssessmentArtifact(
    artifact.storagePath
  )
  const isPdf =
    contentType.toLowerCase().includes('pdf') ||
    (bytes.length >= 4 && bytes.subarray(0, 4).toString() === '%PDF')
  if (!isPdf) return
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const copied = await pdf.copyPages(source, source.getPageIndices())
  for (const p of copied) pdf.addPage(p)
}

export async function buildAssembledClinicalAssessmentPdf(input: {
  clientCode: string
  versionNumber: number
  details: AssessmentDetailsRecord | null
  artifacts: ArtifactRow[]
}): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  await drawSummaryPages(
    pdf,
    buildSummaryLines(input.details),
    input.clientCode,
    input.versionNumber
  )
  await appendGraphPages(pdf, input.artifacts, input.clientCode, input.versionNumber)

  const report = input.artifacts.find((a) => a.artifactType === 'INITIAL_REPORT')
  if (report) await appendPdfArtifact(pdf, report)

  const justification = input.artifacts.find(
    (a) => a.artifactType === 'JUSTIFICATION'
  )
  if (justification) await appendPdfArtifact(pdf, justification)

  return Buffer.from(await pdf.save())
}

export function isGraphArtifactType(type: AssessmentArtifactType): boolean {
  return (GRAPH_ARTIFACT_TYPES as readonly string[]).includes(type)
}
