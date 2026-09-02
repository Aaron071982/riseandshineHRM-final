import type { StaffEmailContent, StaffMergeFields } from '../types'
import {
  ACCENT,
  COMPANY_EMAIL,
  coordinatorSignature,
  dearGreeting,
  greeting,
  infoBlock,
  officeEmail,
  officePhone,
  para,
  portalCta,
  sectionRule,
  staffSignature,
  teamSignature,
} from '../shell'
import { childInitialLast, childName, scheduleTable } from '../helpers'

const LOCALE = 'es' as const

export function renderWelcomeEs(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields, LOCALE)
  const phone = officePhone(fields)
  const email = officeEmail(fields)

  return {
    subject: 'Bienvenido/a a Rise & Shine ABA — esto es lo que sigue',
    bodyHtml: `
      ${para(dearGreeting(fields, LOCALE))}
      ${para(`Bienvenido/a a Rise &amp; Shine ABA, y gracias por confiar en nosotros con la atención de <strong>${child}</strong>. Elegir un proveedor de ABA es una decisión importante, y estamos agradecidos de que nos haya elegido para acompañar a su familia.`)}
      ${para(`Hemos incluido su <strong>Paquete de Bienvenida para Padres</strong> como archivo adjunto. Tómese unos minutos para leerlo cuando pueda — explica, en un lenguaje sencillo, exactamente cómo funcionan los servicios de ABA, quién formará parte del equipo de ${child} y el recorrido paso a paso desde hoy hasta la primera sesión de su hijo/a. No hay sorpresas ocultas, y no se espera que ya sepa todo.`)}
      ${para(`Queremos decirle con claridad desde el principio: gran parte de la rapidez con la que ${child} puede comenzar depende de su compañía de seguros, no de nosotros. Seremos honestos con usted en cada etapa sobre cómo van las cosas — incluyendo los momentos en que la demora es del asegurador y genuinamente no hay nada más que podamos hacer para acelerarlo. Nunca se quedará sin saber.`)}
      ${para(`En el próximo día o dos, recibirá un segundo correo nuestro con los formularios de <strong>Admisión y Consentimiento</strong> adjuntos. Complete esos formularios y devuélvalos por correo electrónico según las indicaciones de ese mensaje — devolverlos completos y correctos la primera vez es lo más importante que puede hacer para ayudar a que ${child} comience antes.`)}
      ${para(`Si surge alguna pregunta antes de entonces, no dude en llamarnos al <a href="tel:+18888984774" style="color:#f2652a;text-decoration:none;">${phone}</a> o escribir a <a href="mailto:${email}" style="color:#f2652a;text-decoration:none;">${email}</a>. Preferimos responder una pregunta dos veces antes que que usted se preocupe una sola vez.`)}
      ${teamSignature(LOCALE)}
    `,
  }
}

export function renderConsentRequestEs(
  fields: StaffMergeFields
): StaffEmailContent {
  const child = childName(fields, LOCALE)
  const phone = officePhone(fields)
  const email = officeEmail(fields)

  return {
    subject:
      'Su siguiente paso con Rise & Shine — admisión, consentimiento y documentos',
    bodyHtml: `
      ${para(dearGreeting(fields, LOCALE))}
      ${para(`Ahora que ${child} está registrado/a en nuestro sistema, este es el siguiente paso — y es el que genuinamente está en sus manos. Completarlo a fondo es lo que nos permite avanzar con todo lo demás.`)}
      ${para(`Complete ambos formularios a continuación y envíenos por correo electrónico las copias terminadas (responda a este mensaje o envíelas a <a href="mailto:${email}" style="color:${ACCENT};text-decoration:none;">${email}</a>). Si los formularios en blanco no están adjuntos a este correo, responda y se los enviaremos de inmediato.`)}
      ${infoBlock('Formularios a completar', [
        `El <strong>Formulario de Admisión del Cliente (Formulario 01)</strong> — nos proporciona todo lo necesario para verificar el seguro de ${child} y solicitar la autorización de servicios.`,
        `El <strong>Formulario de Consentimiento y Autorización (Formulario 02)</strong> — nos da su permiso para evaluar y tratar a ${child}, y para compartir con su seguro solo lo que requieran para pagar esa atención. Usted consiente cada punto por separado; nada es todo o nada.`,
      ])}
      ${sectionRule()}
      ${para(`<strong>Cuando responda, adjunte los formularios completados</strong> (y cualquier documento de apoyo que tenga listo). Por ejemplo:`)}
      ${para(`Tarjeta de seguro (frente y reverso), tarjeta de Medicaid si aplica, evaluación diagnóstica, referencia médica para ABA, IEP/IFSP si ${child} tiene uno, documentos de custodia si aplica, y registros previos de ABA.`)}
      ${para(`No podemos comenzar a verificar el seguro sin la tarjeta de seguro, y no podemos solicitar autorización sin la evaluación diagnóstica y la referencia médica — así que esas son las que debe priorizar si está reuniendo documentos poco a poco. Envíe lo que tenga ahora; siempre puede enviar el resto después.`)}
      ${para(`Si una pregunta no aplica a ${child}, escriba &quot;N/A&quot; en lugar de dejarla en blanco — una respuesta en blanco nos retrasa porque no podemos distinguir entre &quot;no aplica&quot; y &quot;se olvidó&quot;. Copie nombres y números de identificación exactamente como aparecen en la tarjeta de seguro; un solo carácter incorrecto puede retrasar la aprobación semanas.`)}
      ${para(`Si algo no está claro, llámenos al <a href="tel:+18888984774" style="color:${ACCENT};text-decoration:none;">${phone}</a> antes de firmar — preferimos explicarlo dos veces.`)}
      ${coordinatorSignature(fields, LOCALE)}
    `,
  }
}

export const DEFAULT_MISSING_DOCS_COPY_ES = [
  'Tarjeta de seguro — frente y reverso',
  'Tarjeta de Medicaid, si aplica — frente y reverso',
  'Informe de evaluación diagnóstica (DSM-5 / diagnóstico de autismo)',
  'Referencia médica o prescripción para ABA',
  'IEP o IFSP, si aplica',
  'Orden de custodia o tutela, si aplica',
  'Registros previos de ABA, si aplica',
]

function missingDocsHtmlEs(fields: StaffMergeFields): string {
  const items =
    fields.missingDocsList.length > 0
      ? fields.missingDocsList
      : DEFAULT_MISSING_DOCS_COPY_ES
  const lis = items
    .map(
      (item) =>
        `<li style="margin:0 0 10px;padding:0;line-height:1.5;color:#2f2318;">${item}</li>`
    )
    .join('')
  return `${sectionRule('Documentos pendientes')}
<ul style="margin:0 0 16px;padding-left:20px;font-size:14px;">${lis}</ul>`
}

export function renderDocsNeededEs(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields, LOCALE)
  const phone = officePhone(fields)

  return {
    subject: `Un paso más para que los servicios de ${child} sigan avanzando`,
    bodyHtml: `
      ${para(dearGreeting(fields, LOCALE))}
      ${para(`Le escribimos con un recordatorio amable, porque no queremos que nada retrase el progreso de ${child} hacia el inicio de servicios.`)}
      ${para(`Para seguir avanzando, aún necesitamos algunos documentos de su parte. En este momento, estos son los elementos pendientes:`)}
      ${missingDocsHtmlEs(fields)}
      ${para(`Tan pronto como los recibamos, podremos continuar con la verificación del seguro y solicitar las aprobaciones que ${child} necesita — cuanto antes los envíe, antes podremos seguir avanzando de nuestro lado.`)}
      ${para(`Envíe los documentos por correo electrónico usando la información de contacto a continuación, o llámenos si necesita ayuda.`)}
      ${portalCta(fields.portalLink, 'Subir documentos de forma segura', LOCALE)}
      ${para(`Si alguno de estos documentos es difícil de obtener — una referencia con un detalle faltante, una evaluación que aún está esperando — llámenos al <a href="tel:+18888984774" style="color:${ACCENT};text-decoration:none;">${phone}</a>. Es común, tiene solución, y le diremos exactamente qué pedir. No tiene que resolverlo solo/a.`)}
      ${coordinatorSignature(fields, LOCALE)}
    `,
  }
}

export function renderBenefitsUpdateEs(
  fields: StaffMergeFields
): StaffEmailContent {
  const child = childName(fields, LOCALE)
  return {
    subject: `Actualización de beneficios para ${child}`,
    bodyHtml: `
      ${para(greeting(fields, LOCALE))}
      ${para(`Estamos verificando los beneficios del seguro para ${child} y compartiremos una actualización clara una vez confirmada la elegibilidad.`)}
      ${para(`No se requiere ninguna acción de su parte en este momento, a menos que le contactemos por una tarjeta de seguro o número de miembro. Gracias por su paciencia.`)}
      ${staffSignature(fields, LOCALE)}
    `,
  }
}

export function renderAssessmentScheduledEs(
  fields: StaffMergeFields
): StaffEmailContent {
  const child = childName(fields, LOCALE)
  const when = fields.assessmentDate
    ? ` el <strong>${fields.assessmentDate}</strong>`
    : ''
  const modality =
    fields.assessmentModality === 'TELEHEALTH'
      ? 'Telemedicina'
      : fields.assessmentModality === 'IN_HOME'
        ? 'En el hogar'
        : null
  const modalityLine = modality
    ? ` Esta visita será <strong>${modality}</strong>.`
    : ''

  return {
    subject: `Evaluación programada para ${child}`,
    bodyHtml: `
      ${para(greeting(fields, LOCALE))}
      ${para(`Se ha programado una evaluación para ${child}${when}.${modalityLine}`)}
      ${infoBlock('Antes de la visita', [
        modality === 'En el hogar'
          ? 'Prepare un espacio tranquilo en su hogar para la evaluación.'
          : modality === 'Telemedicina'
            ? 'Pruebe su cámara y micrófono, y busque un espacio tranquilo para la visita por video.'
            : 'Prepare un espacio tranquilo para la visita.',
        'Traiga evaluaciones recientes o documentos escolares que desee que veamos.',
        'Anote sus preguntas — haremos tiempo para ellas.',
      ])}
      ${para(`Confirmaremos los detalles con usted antes de la cita. Contáctenos usando la información a continuación si necesita reprogramar.`)}
      ${staffSignature(fields, LOCALE)}
    `,
  }
}

export function renderAuthApprovedEs(
  fields: StaffMergeFields
): StaffEmailContent {
  const child = childName(fields, LOCALE)
  return {
    subject: `Autorización aprobada para ${child}`,
    bodyHtml: `
      ${para(greeting(fields, LOCALE))}
      ${para(`Buenas noticias — la autorización para los servicios de ABA de ${child} ha sido aprobada.`)}
      ${para(`Nuestros equipos de personal y coordinación darán los siguientes pasos y le mantendremos informado/a mientras asignamos un terapeuta y confirmamos el horario.`)}
      ${staffSignature(fields, LOCALE)}
    `,
  }
}

export function renderReadyForStaffingEs(
  fields: StaffMergeFields
): StaffEmailContent {
  const child = childName(fields, LOCALE)
  return {
    subject: `Buscando el terapeuta adecuado para ${child}`,
    bodyHtml: `
      ${para(greeting(fields, LOCALE))}
      ${para(`${child} está listo/a para la asignación de personal. Estamos buscando un terapeuta que se ajuste a su horario, ubicación y preferencias.`)}
      ${para(`Le contactaremos tan pronto tengamos una buena opción. Si algo sobre su disponibilidad ha cambiado, responda en cualquier momento.`)}
      ${staffSignature(fields, LOCALE)}
    `,
  }
}

export function renderRbtAssignedEs(
  fields: StaffMergeFields
): StaffEmailContent {
  const child = childName(fields, LOCALE)
  const c = childInitialLast(fields, LOCALE)
  const rbt = fields.rbtName?.trim()
  const who = rbt
    ? `<strong>${rbt}</strong>`
    : 'Un terapeuta de nuestro equipo'

  const contactLines: string[] = []
  if (fields.rbtPhone?.trim()) {
    contactLines.push(`Teléfono: <strong>${fields.rbtPhone.trim()}</strong>`)
  }
  if (fields.rbtEmail?.trim()) {
    contactLines.push(
      `Correo: <a href="mailto:${fields.rbtEmail.trim()}" style="color:#c45a1a;text-decoration:none;">${fields.rbtEmail.trim()}</a>`
    )
  }

  return {
    subject: rbt
      ? `Conozca a ${rbt} — terapeuta de ${child}`
      : `Terapeuta asignado/a para ${child}`,
    bodyHtml: `
      ${para(greeting(fields, LOCALE))}
      ${para(`Tenemos excelentes noticias — ${who} ha sido asignado/a para trabajar con ${child}. Elegimos esta combinación cuidadosamente según las necesidades y el horario de su familia.`)}
      ${para(`En esta etapa, su terapeuta está asignado/a al caso de ${c}. Coordinaremos el horario y una reunión de presentación para que puedan conectarse antes de que comiencen las sesiones.`)}
      ${
        contactLines.length
          ? infoBlock(
              `${rbt ?? 'Su terapeuta'} — información de contacto`,
              contactLines
            )
          : para(`Compartiremos los datos de contacto de su terapeuta en breve.`)
      }
      ${para(`Si tiene preguntas sobre el horario mientras tanto, contáctenos usando la información a continuación.`)}
      ${staffSignature(fields, LOCALE)}
    `,
  }
}

export function renderScheduleConfirmedEs(
  fields: StaffMergeFields
): StaffEmailContent {
  const child = childName(fields, LOCALE)
  const start = fields.startDate
    ? ` Inicio planificado: <strong>${fields.startDate}</strong>.`
    : ''

  return {
    subject: `Horario confirmado para ${child}`,
    bodyHtml: `
      ${para(greeting(fields, LOCALE))}
      ${para(`El horario de terapia de ${child} está confirmado.${start} A continuación está su horario semanal a la fecha de hoy.`)}
      ${scheduleTable(fields.scheduleSlots, LOCALE)}
      ${para(`Si necesita ajustar un día u hora, contáctenos usando la información a continuación para que podamos actualizar la cobertura.`)}
      ${staffSignature(fields, LOCALE)}
    `,
  }
}

export const LEGACY_RENDERERS_ES = {
  CC_INTRODUCTION: (f: StaffMergeFields): StaffEmailContent => {
    const child = childName(f, LOCALE)
    const coord = f.coordinatorName?.trim()
    return {
      subject: `Conozca a su coordinador/a de caso para ${child}`,
      bodyHtml: `
        ${para(greeting(f, LOCALE))}
        ${para(
          coord
            ? `Nos complace presentarle a <strong>${coord}</strong>, quien ayudará a coordinar la atención de ${child}.`
            : `Estamos asignando un coordinador/a de caso para guiar la atención de ${child}.`
        )}
        ${para(`Se pondrá en contacto sobre los siguientes pasos. Responda en cualquier momento si tiene preguntas.`)}
        ${staffSignature(f, LOCALE)}
      `,
    }
  },

  CASE_COORDINATION_FORM: (f: StaffMergeFields): StaffEmailContent => {
    const child = childName(f, LOCALE)
    return {
      subject: `Formularios de coordinación de caso para ${child}`,
      bodyHtml: `
        ${para(greeting(f, LOCALE))}
        ${para(`Revise y complete los formularios de coordinación de caso para que podamos finalizar el plan de atención de ${child}.`)}
        ${para(`Si hay un formulario adjunto, complete las secciones resaltadas y responda cuando termine. Estamos aquí si algo no está claro.`)}
      `,
    }
  },

  MANUAL: (f: StaffMergeFields): StaffEmailContent => {
    const child = childName(f, LOCALE)
    return {
      subject: `Actualización sobre ${child}`,
      bodyHtml: `
        ${para(greeting(f, LOCALE))}
        ${para(`Queríamos comunicarnos con usted sobre ${child}. Vea el mensaje a continuación y responda si tiene preguntas.`)}
        ${staffSignature(f, LOCALE)}
      `,
    }
  },
}
