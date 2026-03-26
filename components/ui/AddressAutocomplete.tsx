'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPin, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StructuredAddress {
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
  fullAddress: string
}

/** @deprecated Use StructuredAddress */
export type AddressComponents = StructuredAddress

interface Suggestion {
  mapbox_id: string
  full_address: string
  place_name: string
}

interface AddressAutocompleteProps {
  onAddressSelect: (address: StructuredAddress) => void
  defaultValue?: string
  placeholder?: string
  className?: string
  disabled?: boolean
  id?: string
  label?: string
  required?: boolean
  mode?: 'full' | 'cityZipOnly'
  /** When provided, called on every input change so parent can persist manual entry (e.g. for single-field city/zip). */
  onChange?: (value: string) => void
}

const DEBOUNCE_MS = 300
const MIN_CHARS = 3

export default function AddressAutocomplete({
  onAddressSelect,
  defaultValue = '',
  placeholder = 'Start typing an address...',
  className,
  disabled = false,
  id = 'address-autocomplete',
  label,
  required = false,
  mode = 'full',
  onChange: onChangeProp,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(defaultValue)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [verified, setVerified] = useState<'verified' | 'unverified' | null>(null)
  const [apiFailed, setApiFailed] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sessionTokenRef = useRef(crypto.randomUUID())

  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.length < MIN_CHARS) {
      setSuggestions([])
      return
    }
    setLoading(true)
    setApiFailed(false)
    try {
      const params = new URLSearchParams({
        q: input,
        session_token: sessionTokenRef.current,
      })
      const res = await fetch(`/api/mapbox/autocomplete?${params.toString()}`)
      const data = await res.json()
      if (!Array.isArray(data)) {
        setSuggestions([])
        setApiFailed(true)
        return
      }
      setSuggestions(data)
      setSelectedIndex(-1)
    } catch {
      setSuggestions([])
      setApiFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query)
      debounceRef.current = null
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, fetchSuggestions])

  useEffect(() => {
    setQuery(defaultValue ?? '')
  }, [defaultValue])

  const selectSuggestion = useCallback(
    async (suggestion: Suggestion) => {
      setOpen(false)
      setSuggestions([])
      setLoading(true)
      setApiFailed(false)
      try {
        const params = new URLSearchParams({
          mapbox_id: suggestion.mapbox_id,
          session_token: sessionTokenRef.current,
        })
        const res = await fetch(`/api/mapbox/details?${params.toString()}`)
        if (!res.ok) throw new Error('Details failed')
        const raw = await res.json()
        const address: StructuredAddress = {
          addressLine1: raw.address_line1 ?? '',
          addressLine2: raw.address_line2 ?? '',
          city: raw.city ?? '',
          state: raw.state ?? '',
          zipCode: raw.postcode ?? '',
          fullAddress: raw.full_address ?? suggestion.full_address,
        }
        onAddressSelect(address)
        setVerified('verified')
        setHasInteracted(true)
        if (mode === 'cityZipOnly') {
          setQuery([address.city, address.zipCode].filter(Boolean).join(', '))
        } else {
          setQuery(address.fullAddress)
        }
      } catch {
        setApiFailed(true)
        setVerified('unverified')
        setHasInteracted(true)
      } finally {
        setLoading(false)
      }
    },
    [onAddressSelect, mode]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => (i < suggestions.length - 1 ? i + 1 : i))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => (i > 0 ? i - 1 : -1))
    } else if (e.key === 'Enter' && selectedIndex >= 0 && suggestions[selectedIndex]) {
      e.preventDefault()
      selectSuggestion(suggestions[selectedIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setSelectedIndex(-1)
    }
  }

  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const el = listRef.current.children[selectedIndex] as HTMLElement
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    setOpen(true)
    setHasInteracted(true)
    if (verified === 'verified') setVerified('unverified')
    onChangeProp?.(value)
  }

  const handleBlur = () => {
    setTimeout(() => setOpen(false), 200)
    if (hasInteracted && query.trim() && verified !== 'verified') {
      setVerified('unverified')
    }
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onOutside = (e: MouseEvent) => {
      if (el.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const secondaryLine = (s: Suggestion) => {
    if (s.place_name && s.place_name !== s.full_address) return s.place_name
    const parts = s.full_address.split(',').map((p) => p.trim())
    if (parts.length >= 2) return parts.slice(1).join(', ')
    return ''
  }

  return (
    <div className={className} ref={containerRef}>
      {label != null && (
        <Label htmlFor={id}>
          {label} {required && '*'}
        </Label>
      )}
      <div className="relative mt-1.5">
        <div className="relative">
          <Input
            id={id}
            type="text"
            autoComplete="off"
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            value={query}
            onChange={handleChange}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            aria-expanded={open && suggestions.length > 0}
            aria-controls={`${id}-list`}
            aria-activedescendant={
              selectedIndex >= 0 && suggestions[selectedIndex]
                ? `${id}-opt-${selectedIndex}`
                : undefined
            }
            className="pr-9"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1">
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!loading && hasInteracted && verified === 'verified' && (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
            )}
            {!loading && hasInteracted && verified === 'unverified' && query.trim() && (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
          </span>
        </div>

        {open && (suggestions.length > 0 || loading) && !apiFailed && (
          <ul
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            className="absolute z-[9999] mt-1 w-full rounded-md border border-input bg-background py-1 shadow-lg overflow-auto max-h-60 animate-in fade-in duration-150"
          >
            {loading && suggestions.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </li>
            ) : (
              suggestions.map((s, i) => (
                <li
                  key={s.mapbox_id}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={selectedIndex === i}
                  className={cn(
                    'cursor-pointer px-3 py-2.5 min-h-[44px] flex items-center gap-2 rounded-sm',
                    selectedIndex === i ? 'bg-muted' : 'hover:bg-muted/80'
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    selectSuggestion(s)
                  }}
                >
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{s.full_address}</div>
                    {secondaryLine(s) && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {secondaryLine(s)}
                      </div>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        )}

        {hasInteracted && (
          <p className="text-xs mt-1 text-muted-foreground">
            {verified === 'verified' && 'Address verified'}
            {verified === 'unverified' && query.trim() && 'Address not verified'}
          </p>
        )}
      </div>
    </div>
  )
}
