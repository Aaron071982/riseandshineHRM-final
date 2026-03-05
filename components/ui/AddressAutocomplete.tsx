'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface AddressComponents {
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  zipCode: string
}

interface AddressAutocompleteProps {
  onPlaceSelect: (address: AddressComponents) => void
  placeholder?: string
  id?: string
  label?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

const DEBOUNCE_MS = 300

export default function AddressAutocomplete({
  onPlaceSelect,
  placeholder = 'Start typing an address...',
  id = 'address-autocomplete',
  label = 'Address',
  required = false,
  disabled = false,
  className,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState('')
  const [predictions, setPredictions] = useState<Array<{ placeId: string; description: string }>>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setPredictions([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/places/autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      })
      const data = await res.json()
      setPredictions(data.predictions ?? [])
      setSelectedIndex(-1)
    } catch {
      setPredictions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchPredictions(query)
      debounceRef.current = null
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, fetchPredictions])

  const selectPlace = useCallback(
    async (placeId: string, description: string) => {
      setOpen(false)
      setPredictions([])
      setQuery(description)
      setLoading(true)
      try {
        const res = await fetch(
          `/api/places/details?placeId=${encodeURIComponent(placeId)}`
        )
        if (!res.ok) throw new Error('Details failed')
        const address = await res.json()
        onPlaceSelect({
          addressLine1: address.addressLine1 ?? '',
          addressLine2: address.addressLine2 ?? null,
          city: address.city ?? '',
          state: address.state ?? '',
          zipCode: address.zipCode ?? '',
        })
      } catch {
        // leave form fields unchanged
      } finally {
        setLoading(false)
      }
    },
    [onPlaceSelect]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || predictions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => (i < predictions.length - 1 ? i + 1 : i))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => (i > 0 ? i - 1 : -1))
    } else if (e.key === 'Enter' && selectedIndex >= 0 && predictions[selectedIndex]) {
      e.preventDefault()
      const p = predictions[selectedIndex]
      selectPlace(p.placeId, p.description)
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

  return (
    <div className={className}>
      {label && (
        <Label htmlFor={id}>
          {label} {required && '*'}
        </Label>
      )}
      <div className="relative mt-1.5">
        <Input
          id={id}
          type="text"
          autoComplete="off"
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onKeyDown={handleKeyDown}
          aria-expanded={open && predictions.length > 0}
          aria-controls={`${id}-list`}
          aria-activedescendant={
            selectedIndex >= 0 && predictions[selectedIndex]
              ? `${id}-opt-${selectedIndex}`
              : undefined
          }
        />
        {open && (predictions.length > 0 || loading) && (
          <ul
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            className="absolute z-50 mt-1 w-full rounded-md border border-input bg-background py-1 shadow-lg max-h-60 overflow-auto"
          >
            {loading && predictions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">Searching...</li>
            ) : (
              predictions.map((p, i) => (
                <li
                  key={p.placeId}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={selectedIndex === i}
                  className={`cursor-pointer px-3 py-2 text-sm ${selectedIndex === i ? 'bg-muted' : 'hover:bg-muted/80'}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    selectPlace(p.placeId, p.description)
                  }}
                >
                  {p.description}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Select an address from the list to auto-fill the fields below.
      </p>
    </div>
  )
}
