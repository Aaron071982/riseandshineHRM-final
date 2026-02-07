import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  })
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })
}

/**
 * Parses a datetime-local value (YYYY-MM-DDTHH:mm) as America/New_York and returns a Date in UTC for storage.
 */
export function parseLocalTimeAsNY(dateTimeLocal: string): Date {
  if (!dateTimeLocal || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateTimeLocal)) {
    return new Date(dateTimeLocal)
  }
  const [datePart, timePart] = dateTimeLocal.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [h, min] = timePart.split(':').map(Number)
  const utcNoon = Date.UTC(y, m - 1, d, 12, 0, 0)
  const nyHour = parseInt(
    new Date(utcNoon).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      hour12: false,
    }),
    10
  )
  const offsetHours = 12 - nyHour
  return new Date(Date.UTC(y, m - 1, d, h + offsetHours, min, 0))
}

