/**
 * Minimal types for Google Maps Places API (Autocomplete + getDetails).
 * Enable Places API and Maps JavaScript API in Google Cloud for address autocomplete.
 * Window.google is declared as any in SchedulingBetaMap.tsx.
 */

export interface PlaceResult {
  place_id?: string
  formatted_address?: string
  address_components?: Array<{ long_name: string; short_name: string; types: string[] }>
}

export interface GeocoderAddressComponent {
  long_name: string
  short_name: string
  types: string[]
}

export {}
