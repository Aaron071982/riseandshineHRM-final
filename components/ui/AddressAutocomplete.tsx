'use client'

import { useRef, useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { GeocoderAddressComponent, PlaceResult } from '@/types/google-maps-places'

declare global {
  interface Window {
    __addressAutocompleteInit?: (() => void) | null
  }
}

export interface AddressComponents {
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  zipCode: string
}

interface AddressAutocompleteProps {
  apiKey: string
  onPlaceSelect: (address: AddressComponents) => void
  placeholder?: string
  id?: string
  label?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

function getComponent(
  components: GeocoderAddressComponent[],
  type: string,
  useShort = false
): string {
  const c = components.find((c) => c.types.includes(type))
  return c ? (useShort ? c.short_name : c.long_name) : ''
}

/**
 * Parses Google address_components into a standardized format (US-style).
 * Uses locality or sublocality_level_1 for city (e.g. NYC boroughs).
 */
export function parseAddressComponents(
  components: GeocoderAddressComponent[]
): AddressComponents {
  const streetNumber = getComponent(components, 'street_number')
  const route = getComponent(components, 'route')
  const addressLine1 = [streetNumber, route].filter(Boolean).join(' ').trim() || ''
  const city =
    getComponent(components, 'locality') ||
    getComponent(components, 'sublocality_level_1') ||
    getComponent(components, 'sublocality')
  const state = getComponent(components, 'administrative_area_level_1', true)
  const zipCode =
    getComponent(components, 'postal_code') +
    (getComponent(components, 'postal_code_suffix') ? `-${getComponent(components, 'postal_code_suffix')}` : '')
  return {
    addressLine1,
    addressLine2: null,
    city,
    state,
    zipCode,
  }
}

export default function AddressAutocomplete({
  apiKey,
  onPlaceSelect,
  placeholder = 'Start typing an address...',
  id = 'address-autocomplete',
  label = 'Address',
  required = false,
  disabled = false,
  className,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)

  useEffect(() => {
    if (!apiKey || !inputRef.current) return

    const loadScript = () => {
      if (window.google?.maps?.places) {
        setScriptLoaded(true)
        return
      }
      if (window.__addressAutocompleteInit) return
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
      script.async = true
      script.defer = true
      window.__addressAutocompleteInit = () => {
        setScriptLoaded(true)
        window.__addressAutocompleteInit = null
      }
      script.onload = () => {
        if (window.google?.maps?.places) {
          setScriptLoaded(true)
          window.__addressAutocompleteInit = null
        }
      }
      document.head.appendChild(script)
    }

    loadScript()
  }, [apiKey])

  useEffect(() => {
    if (!scriptLoaded || !window.google?.maps?.places || !inputRef.current) return

    const input = inputRef.current
    const autocomplete = new window.google.maps.places.Autocomplete(input, {
      types: ['address'],
      fields: ['place_id', 'address_components'],
      componentRestrictions: { country: 'us' },
    })

    const handlePlaceChange = () => {
      const place = autocomplete.getPlace()
      if (!place?.place_id) return
      if (place.address_components?.length) {
        const parsed = parseAddressComponents(place.address_components)
        onPlaceSelect(parsed)
        if (input) input.value = place.formatted_address || ''
        return
      }
      const mapDiv = document.createElement('div')
      const service = new window.google.maps.places.PlacesService(mapDiv)
      service.getDetails(
        { placeId: place.place_id, fields: ['address_components'] },
        (details: PlaceResult | null, status: string) => {
          if (status === 'OK' && details?.address_components?.length) {
            const parsed = parseAddressComponents(details.address_components as GeocoderAddressComponent[])
            onPlaceSelect(parsed)
            if (input) input.value = details.formatted_address ?? place.formatted_address ?? ''
          }
        }
      )
    }

    autocomplete.addListener('place_changed', handlePlaceChange)
    return () => {
      window.google?.maps?.event?.clearInstanceListeners?.(autocomplete)
    }
  }, [scriptLoaded, onPlaceSelect])

  return (
    <div className={className}>
      {label && (
        <Label htmlFor={id}>
          {label} {required && '*'}
        </Label>
      )}
      <Input
        ref={inputRef}
        id={id}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="mt-1.5"
      />
      <p className="text-xs text-muted-foreground mt-1">
        Select an address from the dropdown to auto-fill city, state, and zip.
      </p>
    </div>
  )
}
