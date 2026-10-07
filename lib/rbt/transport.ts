import { NYC_BOROUGHS } from '@/lib/schedule/borough'

export const TRANSPORT_MODES = ['CAR', 'TRANSIT'] as const

export type TransportMode = (typeof TRANSPORT_MODES)[number]

export const TRANSPORT_MODE_LABELS: Record<TransportMode, string> = {
  CAR: 'Car',
  TRANSIT: 'Public transit',
}

export const TRAVEL_BOROUGHS = NYC_BOROUGHS

export function parseTransportMode(raw: unknown): TransportMode | null {
  return typeof raw === 'string' && (TRANSPORT_MODES as readonly string[]).includes(raw)
    ? (raw as TransportMode)
    : null
}

export function parseTravelBoroughs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const allowed = new Set<string>(TRAVEL_BOROUGHS)
  return raw.filter((b): b is string => typeof b === 'string' && allowed.has(b))
}

export function transportModeLabel(mode: string | null | undefined): string | null {
  const parsed = parseTransportMode(mode)
  return parsed ? TRANSPORT_MODE_LABELS[parsed] : null
}
