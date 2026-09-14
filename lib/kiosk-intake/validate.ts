import 'server-only'

import {
  fieldValueIsSet,
  getEnabledRequiredForms,
  getFormDef,
  type IntakeFormDef,
} from '@/lib/kiosk-intake/schema'

export type IntakeFormsPayload = Record<string, Record<string, unknown>>

export function validateIntakeFormsPayload(forms: unknown): {
  ok: true
  forms: IntakeFormsPayload
} | {
  ok: false
  error: string
  status: number
} {
  if (!forms || typeof forms !== 'object' || Array.isArray(forms)) {
    return { ok: false, error: 'forms must be an object keyed by form code', status: 400 }
  }

  const payload = forms as IntakeFormsPayload

  for (const code of Object.keys(payload)) {
    const def = getFormDef(code)
    if (!def) {
      return { ok: false, error: `Unknown form code: ${code}`, status: 400 }
    }
    if (!def.enabled) {
      return {
        ok: false,
        error: `Form ${code} is disabled and cannot be submitted`,
        status: 400,
      }
    }
    const values = payload[code]
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return {
        ok: false,
        error: `forms.${code} must be an object of field values`,
        status: 400,
      }
    }
  }

  for (const required of getEnabledRequiredForms()) {
    if (!(required.code in payload)) {
      return {
        ok: false,
        error: `Missing required form: ${required.code}`,
        status: 400,
      }
    }
  }

  for (const [code, values] of Object.entries(payload)) {
    const def = getFormDef(code)!
    const fieldError = validateFormFieldValues(def, values)
    if (fieldError) {
      return { ok: false, error: fieldError, status: 400 }
    }
  }

  return { ok: true, forms: payload }
}

function validateFormFieldValues(
  def: IntakeFormDef,
  values: Record<string, unknown>
): string | null {
  for (const field of def.fields) {
    if (!field.required) continue
    if (!fieldValueIsSet(values[field.name], field.type)) {
      return `Form ${def.code}: required field "${field.name}" is missing`
    }
  }
  return null
}
