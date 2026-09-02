import type { StaffEmailContent, StaffMergeFields } from '../types'
import {
  CASE_COORDINATION_BILLING_GUIDELINES_ES,
  CASE_COORDINATION_CLINICAL_COMPLIANCE_ES,
  CASE_COORDINATION_CONTACT_PROMPT_ES,
  CASE_COORDINATION_INTRO_ES,
  CASE_COORDINATION_POLICY_INTRO_ES,
  CASE_COORDINATION_POLICY_ITEMS_ES,
} from '@/lib/crm/caseCoordination/boilerplateEs'
import { CASE_COORDINATION_CONTACT_EMAIL } from '@/lib/crm/caseCoordination/boilerplate'
import { formatScheduleForBt } from '@/lib/crm/caseCoordination/scheduleString'
import { escapeHtml, para } from '../shell'
import { contactBlock, emailGuideSection, formatClientAddress } from '../helpers'

const LOCALE = 'es' as const
const NOT_ASSIGNED = 'Aún no asignado'

function groupBtRows(fields: StaffMergeFields) {
  const byName = new Map<
    string,
    { name: string; slots: { dayOfWeek: number; startTime: string; endTime: string }[] }
  >()
  for (const slot of fields.scheduleSlots) {
    const name = slot.rbtName.trim() || 'Técnico/a de conducta'
    const row = byName.get(name) ?? { name, slots: [] }
    row.slots.push({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
    })
    byName.set(name, row)
  }
  return [...byName.values()]
}

function btTableHtmlEs(fields: StaffMergeFields): string {
  const rows = groupBtRows(fields)
  if (!rows.length) {
    return `<p style="margin:8px 0;font-style:italic;color:#6b5e54;">${NOT_ASSIGNED}</p>`
  }
  const body = rows
    .map((row) => {
      const schedule = formatScheduleForBt(row.slots) || NOT_ASSIGNED
      const contact =
        row.name === fields.rbtName?.trim()
          ? [fields.rbtPhone, fields.rbtEmail].filter(Boolean).join(' · ')
          : ''
      return `<tr>
        <td style="padding:8px 10px;border:1px solid #d8d0c8;">${escapeHtml(row.name)}</td>
        <td style="padding:8px 10px;border:1px solid #d8d0c8;">${escapeHtml(contact || '—')}</td>
        <td style="padding:8px 10px;border:1px solid #d8d0c8;">${escapeHtml(schedule)}</td>
        <td style="padding:8px 10px;border:1px solid #d8d0c8;">${escapeHtml(fields.startDate ?? NOT_ASSIGNED)}</td>
      </tr>`
    })
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0;">
    <tr style="background:#e6f7f5;">
      <th align="left" style="padding:8px 10px;border:1px solid #d8d0c8;font-size:11px;">Técnico/a de conducta</th>
      <th align="left" style="padding:8px 10px;border:1px solid #d8d0c8;font-size:11px;">Teléfono/Correo</th>
      <th align="left" style="padding:8px 10px;border:1px solid #d8d0c8;font-size:11px;">Horario</th>
      <th align="left" style="padding:8px 10px;border:1px solid #d8d0c8;font-size:11px;">Fecha de inicio</th>
    </tr>
    ${body}
  </table>`
}

export function renderCaseCoordinationEs(
  fields: StaffMergeFields
): StaffEmailContent {
  const clientName = `${fields.childFirstName} ${fields.childLastName}`.trim()
  const address = formatClientAddress(fields)

  const clientBlock = contactBlock('Información del cliente', [
    { label: 'Nombre del cliente', value: clientName },
    { label: 'Dirección de servicio', value: address },
    { label: 'Nombre del padre/madre o tutor/a', value: fields.parentName },
    { label: 'Correo del padre/madre', value: fields.parentEmail },
    { label: 'Teléfono de contacto', value: fields.parentPhone },
  ])

  const bcbaBlock = contactBlock('Información del BCBA supervisor', [
    { label: 'Nombre del BCBA', value: fields.bcbaName },
    { label: 'Teléfono de contacto', value: fields.bcbaPhone },
    { label: 'Correo electrónico', value: fields.bcbaEmail },
  ])

  const coordinatorBlock = contactBlock('Información del coordinador/a de caso', [
    { label: 'Nombre', value: fields.coordinatorName },
    { label: 'Teléfono de contacto', value: fields.coordinatorPhone },
    { label: 'Correo electrónico', value: fields.coordinatorEmail },
  ])

  const billingHtml = `<ul style="margin:8px 0 0;padding-left:18px;">${CASE_COORDINATION_BILLING_GUIDELINES_ES.map(
    (item) => `<li style="margin:0 0 8px;">${escapeHtml(item)}</li>`
  ).join('')}</ul>`

  const policyHtml = `<p style="margin:0 0 8px;">${escapeHtml(CASE_COORDINATION_POLICY_INTRO_ES)}</p>
    <ul style="margin:0;padding-left:18px;">${CASE_COORDINATION_POLICY_ITEMS_ES.map(
      (item) => `<li style="margin:0 0 8px;">${escapeHtml(item)}</li>`
    ).join('')}</ul>`

  const complianceHtml = `${para(CASE_COORDINATION_CLINICAL_COMPLIANCE_ES)}
    ${para(`${CASE_COORDINATION_CONTACT_PROMPT_ES} ${CASE_COORDINATION_CONTACT_EMAIL}`)}`

  return {
    subject: `Coordinación de caso — ${clientName}`,
    bodyHtml: `
      ${para('Estimado equipo,')}
      ${para(CASE_COORDINATION_INTRO_ES)}
      ${emailGuideSection('INFORMACIÓN DEL CLIENTE', clientBlock)}
      ${emailGuideSection('INFORMACIÓN DEL BCBA SUPERVISOR', bcbaBlock)}
      ${emailGuideSection('INFORMACIÓN DEL TÉCNICO/A DE CONDUCTA', btTableHtmlEs(fields))}
      ${emailGuideSection('INFORMACIÓN DEL COORDINADOR/A DE CASO', coordinatorBlock)}
      ${emailGuideSection('FACTURACIÓN Y DIRECTRICES DE SESIÓN', billingHtml)}
      ${emailGuideSection('RECORDATORIO DE POLÍTICAS', policyHtml)}
      ${emailGuideSection('DECLARACIÓN DE CUMPLIMIENTO CLÍNICO', complianceHtml)}
    `,
  }
}
