import 'server-only'

import fs from 'fs'
import path from 'path'
import schemaJson from '@/kiosk-intake/intake-forms-schema.json'

export type IntakeFieldType = 'text' | 'checkbox'

export type IntakeFieldDef = {
  name: string
  type: IntakeFieldType
  required: boolean
}

export type SignaturePlacement = {
  x: number
  y: number
  maxWidth: number
  maxHeight: number
}

export type IntakeFormDef = {
  code: string
  title: string
  template: string
  enabled: boolean
  required: boolean
  signaturePlacement: SignaturePlacement
  fields: IntakeFieldDef[]
}

export type IntakeFormsSchema = {
  version: number
  requiredFormCodes: string[]
  forms: IntakeFormDef[]
}

const schema = schemaJson as IntakeFormsSchema

export function getIntakeFormsSchema(): IntakeFormsSchema {
  return schema
}

export function getRequiredFormCodes(): string[] {
  return [...schema.requiredFormCodes]
}

export function getFormDef(code: string): IntakeFormDef | undefined {
  return schema.forms.find((f) => f.code === code)
}

export function getEnabledRequiredForms(): IntakeFormDef[] {
  return schema.forms.filter((f) => f.enabled && f.required)
}

/** Absolute path to a blank template PDF under /kiosk-intake. */
export function getTemplatePath(templateFileName: string): string {
  return path.join(process.cwd(), 'kiosk-intake', templateFileName)
}

export function assertTemplateExists(templateFileName: string): string {
  const p = getTemplatePath(templateFileName)
  if (!fs.existsSync(p)) {
    throw new Error(`Missing intake template: ${templateFileName}`)
  }
  return p
}

export function isCheckboxField(form: IntakeFormDef, fieldName: string): boolean {
  const def = form.fields.find((f) => f.name === fieldName)
  if (def) return def.type === 'checkbox'
  return (
    fieldName.startsWith('t_') ||
    fieldName.startsWith('p_') ||
    fieldName.startsWith('i_') ||
    fieldName.startsWith('o_') ||
    fieldName.startsWith('a_') ||
    fieldName.startsWith('d_') ||
    fieldName.startsWith('s_') ||
    fieldName.startsWith('b_') ||
    fieldName.startsWith('e_ack') ||
    fieldName.startsWith('ill_') ||
    fieldName.startsWith('med_rescue') ||
    fieldName.startsWith('med_auth') ||
    fieldName.startsWith('f_ack') ||
    fieldName.startsWith('roi_release') ||
    fieldName.startsWith('roi_obtain')
  )
}

export function fieldValueIsSet(value: unknown, type: IntakeFieldType): boolean {
  if (type === 'checkbox') return value === true
  if (value == null) return false
  return String(value).trim().length > 0
}
