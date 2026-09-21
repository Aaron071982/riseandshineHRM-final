import type { StaffEmailContent, StaffMergeFields } from '../types'
import {
  dearGreeting,
  officeEmail,
  officePhone,
  para,
  teamSignature,
} from '../shell'
import { childName } from '../helpers'

export function renderWaitlistNoticeEs(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields, 'es')
  const phone = officePhone(fields)
  const email = officeEmail(fields)

  return {
    subject: `Actualización sobre la solicitud de ${child} — lista de espera`,
    bodyHtml: `
      ${para(dearGreeting(fields, 'es'))}
      ${para(`Gracias por contactar a Rise &amp; Shine ABA sobre el cuidado de <strong>${child}</strong>. Agradecemos sinceramente su interés en nuestros servicios y la confianza que depositan en nosotros.`)}
      ${para(`En este momento, no podemos iniciar el proceso de admisión ni ofrecer servicios para ${child}. Hemos colocado a su familia en nuestra <strong>lista de espera</strong> para poder contactarlos tan pronto como nuestra capacidad y circunstancias nos permitan atenderlos.`)}
      ${para(`Esto no significa que estemos rechazando su solicitud de forma permanente. Significa que queremos ser transparentes: no podemos dar pasos concretos ahora, y no les pediremos que completen formularios ni reúnan documentos hasta que estemos en condiciones de avanzar.`)}
      ${para(`Cuando haya disponibilidad, un miembro de nuestro equipo de admisión se comunicará con ustedes usando la información que nos proporcionaron. Por ahora, no necesitan hacer nada.`)}
      ${para(`Si su situación cambia, o si desean retirarse de la lista de espera, respondan a este mensaje o contáctenos al <a href="tel:+18888984774" style="color:#e7692c;text-decoration:none;">${phone}</a> o <a href="mailto:${email}" style="color:#e7692c;text-decoration:none;">${email}</a>.`)}
      ${para(`Gracias nuevamente por considerar a Rise &amp; Shine. Esperamos poder acompañar a su familia cuando sea posible.`)}
      ${teamSignature('es')}
    `,
  }
}
