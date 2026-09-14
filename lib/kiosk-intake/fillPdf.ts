import 'server-only'

import fs from 'fs'
import { PDFDocument, type PDFForm } from 'pdf-lib'
import { formatUsMmDdYyyy } from '@/lib/billing/calendarDate'
import {
  assertTemplateExists,
  isCheckboxField,
  type IntakeFormDef,
  type SignaturePlacement,
} from '@/lib/kiosk-intake/schema'

function todayMmDdYyyy(): string {
  return formatUsMmDdYyyy(new Date()) || ''
}

function setTextMaybe(form: PDFForm, name: string, value: string) {
  try {
    form.getTextField(name).setText(value)
  } catch {
    // Field missing on this template — skip.
  }
}

function setCheckboxMaybe(form: PDFForm, name: string, checked: boolean) {
  try {
    const box = form.getCheckBox(name)
    if (checked) box.check()
    else box.uncheck()
  } catch {
    // Field missing on this template — skip.
  }
}

async function stampSignature(
  pdf: PDFDocument,
  placement: SignaturePlacement,
  signaturePngBytes: Buffer
): Promise<void> {
  // Do not catch — embed/draw failures must fail the submit loudly.
  const png = await pdf.embedPng(signaturePngBytes)
  const page = pdf.getPages()[0]
  if (!page) {
    throw new Error('Intake template has no pages to stamp signature')
  }
  const scale = Math.min(
    placement.maxWidth / png.width,
    placement.maxHeight / png.height
  )
  page.drawImage(png, {
    x: placement.x,
    y: placement.y,
    width: png.width * scale,
    height: png.height * scale,
  })
}

export type FillIntakePdfParams = {
  formDef: IntakeFormDef
  client: {
    firstName: string
    lastName: string
    dateOfBirth: Date | null
  }
  signerName: string
  values: Record<string, unknown>
  /** Raw PNG bytes (data-URL prefix already stripped). */
  signaturePngBytes: Buffer
}

/** Load template, fill fields, flatten, stamp signature, return base64 PDF. */
export async function fillIntakePdf(params: FillIntakePdfParams): Promise<string> {
  const templatePath = assertTemplateExists(params.formDef.template)
  const bytes = fs.readFileSync(templatePath)
  const pdf = await PDFDocument.load(bytes)
  const form = pdf.getForm()

  const childName = `${params.client.firstName} ${params.client.lastName}`.trim()
  setTextMaybe(form, 'child_name', childName)
  setTextMaybe(form, 'dob', formatUsMmDdYyyy(params.client.dateOfBirth) || '')
  setTextMaybe(form, 'print_name', params.signerName)
  setTextMaybe(form, 'sig_date', todayMmDdYyyy())

  for (const [name, val] of Object.entries(params.values)) {
    if (
      name === 'child_name' ||
      name === 'dob' ||
      name === 'print_name' ||
      name === 'sig_date'
    ) {
      continue
    }
    if (isCheckboxField(params.formDef, name)) {
      setCheckboxMaybe(form, name, val === true || val === 'true' || val === 1)
    } else {
      setTextMaybe(form, name, val == null ? '' : String(val))
    }
  }

  form.flatten()

  const placement = params.formDef.signaturePlacement
  if (!placement) {
    throw new Error(
      `Form ${params.formDef.code} is missing signaturePlacement in intake-forms-schema.json`
    )
  }
  await stampSignature(pdf, placement, params.signaturePngBytes)

  const saved = await pdf.save()
  return Buffer.from(saved).toString('base64')
}
