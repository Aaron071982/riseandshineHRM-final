import type { StaffEmailContent, StaffMergeFields } from '../types'
import {
  COMPANY_EMAIL,
  COMPANY_PHONE,
  escapeHtml,
  greeting,
  infoBlock,
  para,
  staffSignature,
} from '../shell'
import {
  contactBlock,
  emailGuideSection,
  formatClientAddress,
  meetGreetWeeklyScheduleTable,
} from '../helpers'

const LOCALE = 'es' as const

function scheduleForMeetGreet(fields: StaffMergeFields) {
  const rbt = fields.rbtName?.trim()
  if (!rbt) return fields.scheduleSlots
  const filtered = fields.scheduleSlots.filter((s) => s.rbtName === rbt)
  return filtered.length ? filtered : fields.scheduleSlots
}

function guideList(items: string[]): string {
  return `<ul style="margin:8px 0 0;padding-left:18px;">${items
    .map((i) => `<li style="margin:0 0 8px;line-height:1.5;">${i}</li>`)
    .join('')}</ul>`
}

function guideIntroBannerEs(rbtName: string | null): string {
  const who = rbtName
    ? `<strong style="color:#c45a1a;">${escapeHtml(rbtName)}</strong>`
    : 'su nuevo/a Técnico/a de Conducta'
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
  <tr>
    <td style="padding:20px 22px;background:linear-gradient(135deg,#fff8f2 0%,#fffcf8 100%);border:1px solid #f0dcc8;border-left:4px solid #f2652a;border-radius:0 12px 12px 0;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#c45a1a;margin-bottom:8px;">Guía de Presentación para Familias</div>
      <div style="font-size:17px;font-weight:700;color:#2f2318;line-height:1.35;">Bienvenido/a — conozca a ${who}</div>
      <p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#6b5e52;">Estamos emocionados de presentarle al Técnico/a de Conducta de su hijo/a. Esta reunión de presentación es una oportunidad para que su familia se sienta cómoda y asegure que sea la opción adecuada antes de que comiencen los servicios.</p>
    </td>
  </tr>
</table>`
}

export function renderMeetAndGreetEs(
  fields: StaffMergeFields
): StaffEmailContent {
  const child = fields.childFirstName.trim() || 'su hijo/a'
  const rbt = fields.rbtName?.trim() || null
  const address = formatClientAddress(fields)
  const slots = scheduleForMeetGreet(fields)

  const coordContact = contactBlock('Su Coordinador/a de Caso', [
    { label: 'Nombre', value: fields.coordinatorName },
    { label: 'Teléfono', value: fields.coordinatorPhone || COMPANY_PHONE },
    {
      label: 'Correo',
      value: fields.coordinatorEmail
        ? fields.coordinatorEmail
        : COMPANY_EMAIL,
    },
  ])

  return {
    subject: rbt
      ? `Presentación — ${rbt} para ${child}`
      : `Reunión de presentación para ${child}`,
    bodyHtml: `
      ${para(greeting(fields, LOCALE))}
      ${para(`Nos gustaría programar una breve reunión de presentación para que pueda conectarse con el equipo de atención de ${child} antes de que comiencen los servicios. Es una oportunidad para hacer preguntas y asegurarse de que todos se sientan cómodos.`)}
      ${infoBlock('Qué sigue', [
        'Comparta algunos horarios que le funcionen esta semana usando la información de contacto a continuación, y confirmaremos su visita.',
        'Revise la guía a continuación — explica qué esperar durante la reunión de presentación.',
        'Enviaremos por separado el formulario oficial de Presentación para que lo revise, complete y firme.',
      ])}

      ${guideIntroBannerEs(rbt)}

      ${emailGuideSection(
        'Antes de la visita — preparación',
        guideList([
          'Tenga disponibles los juguetes, actividades o bocadillos favoritos de su hijo/a.',
          'Algunos Técnicos de Conducta pueden ser más nuevos en el campo — reciben capacitación intensiva y supervisión continua de un BCBA experimentado.',
          'Su BCBA proporciona supervisión clínica durante todo el servicio.',
        ])
      )}

      ${emailGuideSection(
        'Durante la reunión de presentación',
        `<ol style="margin:8px 0 0;padding-left:18px;">
          <li style="margin:0 0 10px;line-height:1.55;"><strong>Presentaciones</strong> — Dé la bienvenida al/a la TC y presente a su hijo/a de una manera tranquila y cómoda.</li>
          <li style="margin:0 0 10px;line-height:1.55;"><strong>Preferencias del niño/a</strong> — Comparta actividades, juguetes y rutinas favoritas; proporcione materiales que puedan ayudar al/a la TC a conectar.</li>
          <li style="margin:0 0 10px;line-height:1.55;"><strong>Período de interacción</strong> — Si se siente cómodo/a, permita un breve juego o interacción para que todos se conozcan.</li>
          <li style="margin:0 0 10px;line-height:1.55;"><strong>Presentación familiar</strong> — Presente a otros miembros del hogar para promover comodidad y familiaridad.</li>
        </ol>`
      )}

      ${emailGuideSection(
        'Temas importantes del hogar y seguridad',
        guideList([
          '<strong>Alergias</strong> (del niño/a y del hogar) — alimentos, ambientales, medicamentos u otras sensibilidades.',
          '<strong>Mascotas en el hogar</strong> — tipo de mascota(s), si estarán presentes durante las sesiones y cómo se aseguran.',
          '<strong>Alergias o sensibilidades del terapeuta</strong> — caspa de mascotas, humo, fragancias fuertes, etc.',
          '<strong>Reglas de la casa</strong> — zapatos, áreas de comida, habitaciones restringidas u otras expectativas.',
          '<strong>Medicamentos</strong> — cualquier cosa que el/a TC deba saber para la seguridad y el cuidado.',
        ]) +
          `<p style="margin:12px 0 0;font-size:13px;color:#6b5e52;font-style:italic;">Registrará los detalles completos en el formulario oficial que enviaremos después — este correo es su guía previa.</p>`
      )}

      ${emailGuideSection(
        'Preguntas para discutir',
        `<p style="margin:0 0 8px;"><strong>Usted puede preguntarle al/a la Técnico/a de Conducta:</strong></p>
        ${guideList([
          '¿Cuál es su método de comunicación preferido?',
          '¿Hay algo que necesite para sentirse cómodo/a en nuestro hogar?',
        ])}
        <p style="margin:14px 0 8px;"><strong>El/la Técnico/a de Conducta puede preguntarle:</strong></p>
        ${guideList([
          '¿Hay reglas de la casa o preocupaciones de seguridad que debamos conocer?',
          '¿Hay algo específico que debamos saber sobre su hijo/a?',
          '¿Qué es lo que más disfruta su hijo/a?',
        ])}`
      )}

      ${emailGuideSection(
        'Después de la reunión de presentación',
        guideList([
          'Considere cómo respondió su hijo/a y si la interacción se sintió positiva.',
          'Contacte a su Coordinador/a de Caso con comentarios, preguntas o actualizaciones de horario.',
          'Confirme los siguientes pasos una vez que se sienta seguro/a de avanzar.',
        ])
      )}

      ${coordContact}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
        <tr>
          <td style="padding:18px 20px;background:#fff8f2;border:1px solid #f0dcc8;border-radius:10px;">
            <div style="font-size:13px;font-weight:700;color:#8b4513;margin:0 0 8px;">Información del horario</div>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#2f2318;">Revise los horarios semanales de servicio planificados a continuación. Los horarios pueden cambiar según necesidades clínicas, disponibilidad del personal y límites de autorización.</p>
            ${meetGreetWeeklyScheduleTable(slots, LOCALE)}
            ${
              address
                ? `<p style="margin:14px 0 0;font-size:14px;color:#2f2318;"><strong>Dirección de servicio:</strong> ${escapeHtml(address)}</p>`
                : ''
            }
            <p style="margin:14px 0 0;font-size:13px;color:#6b5e52;font-style:italic;">La firma y la confirmación formal se recogerán en el formulario de Presentación que enviaremos por separado — no en este correo.</p>
          </td>
        </tr>
      </table>

      ${para(`Esperamos trabajar con su familia y agradecemos su colaboración. Si tiene preguntas sobre el horario, contáctenos usando la información a continuación.`)}
      ${staffSignature(fields, LOCALE)}
    `,
  }
}
