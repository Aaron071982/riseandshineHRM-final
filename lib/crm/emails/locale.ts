export type EmailLocale = 'en' | 'es'

export const DEFAULT_EMAIL_LOCALE: EmailLocale = 'en'

export function normalizeEmailLocale(
  value?: string | null
): EmailLocale {
  if (value === 'es') return 'es'
  return 'en'
}

export const DAY_LABELS_ES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const

export function dayLabel(dayOfWeek: number, locale: EmailLocale): string {
  if (locale === 'es') {
    return DAY_LABELS_ES[dayOfWeek] ?? 'Día'
  }
  const en = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ]
  return en[dayOfWeek] ?? 'Day'
}
