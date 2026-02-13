'use client'

import { useEffect, useRef, useState } from 'react'
import { zipToCoord } from '@/lib/scheduling-beta/zipToCoord'

declare global {
  interface Window {
    google?: typeof google
    initSchedulingBetaMap?: () => void
  }
}

export type RbtMapItem = {
  id: string
  fullName: string
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  zip: string | null
}

export type ClientMapItem = {
  id: string
  name: string
  addressLine1: string
  city: string
  state: string
  zip: string
}

export type RouteRequest = {
  originAddress: string
  destinationAddress: string
  originLabel?: string
  destinationLabel?: string
}

type Props = {
  apiKey: string
  rbts?: RbtMapItem[]
  clients?: ClientMapItem[]
  route?: RouteRequest | null
  onRouteResult?: (distanceText: string, durationText: string, distanceValue: number, durationValue: number) => void
}

export default function SchedulingBetaMap({
  apiKey,
  rbts = [],
  clients = [],
  route = null,
  onRouteResult,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'route' | 'error'>('loading')
  const [distanceText, setDistanceText] = useState<string>('')
  const [durationText, setDurationText] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    if (!apiKey) {
      setStatus('error')
      setErrorMessage('Missing Google Maps API key.')
      return
    }

    const runMap = () => {
      if (!window.google?.maps || !mapRef.current) return

      const g = window.google.maps
      const map = new g.Map(mapRef.current, {
        zoom: 10,
        center: { lat: 40.7128, lng: -74.006 },
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: true,
      })

      const bounds = new g.LatLngBounds()
      let hasAny = false

      // RBT markers (blue-ish)
      const rbtCoords: { lat: number; lng: number; label: string }[] = []
      for (const rbt of rbts) {
        const coord = zipToCoord(rbt.zip) ?? zipToCoord(rbt.city)
        if (coord) {
          rbtCoords.push({ ...coord, label: rbt.fullName })
          bounds.extend(coord)
          hasAny = true
        }
      }
      rbtCoords.forEach(({ lat, lng, label }) => {
        new g.Marker({
          position: { lat, lng },
          map,
          title: `RBT: ${label}`,
          label: { text: 'R', color: 'white', fontWeight: 'bold' },
          icon: {
            path: g.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#2563eb',
            fillOpacity: 1,
            strokeColor: '#1e40af',
            strokeWeight: 2,
          },
        })
      })

      // Client markers (orange/red)
      const clientCoords: { lat: number; lng: number; label: string }[] = []
      for (const client of clients) {
        const coord = zipToCoord(client.zip) ?? zipToCoord(client.city)
        if (coord) {
          clientCoords.push({ ...coord, label: client.name })
          bounds.extend(coord)
          hasAny = true
        }
      }
      clientCoords.forEach(({ lat, lng, label }) => {
        new g.Marker({
          position: { lat, lng },
          map,
          title: `Client: ${label}`,
          label: { text: 'C', color: 'white', fontWeight: 'bold' },
          icon: {
            path: g.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#ea580c',
            fillOpacity: 1,
            strokeColor: '#c2410c',
            strokeWeight: 2,
          },
        })
      })

      if (hasAny) {
        map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 })
      }

      const originAddress = route?.originAddress?.trim()
      const destAddress = route?.destinationAddress?.trim()
      const hasRoute = Boolean(originAddress && destAddress)

      if (hasRoute) {
        const directionsService = new g.DirectionsService()
        const directionsRenderer = new g.DirectionsRenderer({
          map,
          suppressMarkers: false,
        })

        // Use departure_time so we get duration_in_traffic (realistic drive time with traffic)
        const departure = new Date()
        departure.setMinutes(departure.getMinutes() + 15)
        const request: google.maps.DirectionsRequest = {
          origin: originAddress,
          destination: destAddress,
          travelMode: g.TravelMode.DRIVING,
          ...(departure.getTime() > Date.now() && { drivingOptions: { departureTime: departure } }),
        }

        directionsService.route(request, (result, routeStatus) => {
          if (routeStatus !== g.DirectionsStatus.OK || !result) {
            setStatus('error')
            setErrorMessage(routeStatus || 'Could not get route.')
            return
          }
          directionsRenderer.setDirections(result)
          const leg = result.routes[0]?.legs[0]
          if (leg) {
            const distText = leg.distance?.text ?? ''
            const durVal = leg.duration?.value ?? 0
            const durInTraffic = (leg as google.maps.DirectionsLeg & { duration_in_traffic?: { text: string; value: number } }).duration_in_traffic
            const durText = durInTraffic?.text ?? leg.duration?.text ?? ''
            const distVal = leg.distance?.value ?? 0
            setDistanceText(distText)
            setDurationText(durText)
            onRouteResult?.(distText, durText, distVal, durInTraffic?.value ?? durVal)
          }
          setStatus('route')
          if (result.routes[0]?.bounds) {
            bounds.union(result.routes[0].bounds)
            map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 })
          }
        })
      } else {
        setStatus('ready')
      }
    }

    if (window.google?.maps) {
      setTimeout(runMap, 100)
      return
    }

    window.initSchedulingBetaMap = () => {
      setStatus('ready')
      setTimeout(runMap, 100)
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry&callback=initSchedulingBetaMap`
    script.async = true
    script.defer = true
    script.onerror = () => {
      setStatus('error')
      setErrorMessage('Failed to load Google Maps.')
    }
    document.head.appendChild(script)

    return () => {
      delete window.initSchedulingBetaMap
    }
  }, [apiKey, rbts, clients, route, onRouteResult])

  const originLabel = route?.originLabel ?? 'Origin'
  const destLabel = route?.destinationLabel ?? 'Destination'

  return (
    <div className="space-y-2">
      <div
        ref={mapRef}
        className="w-full h-[380px] rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] bg-gray-100 dark:bg-[var(--bg-elevated)]"
      />
      {status === 'loading' && (
        <p className="text-sm text-gray-500">Loading map...</p>
      )}
      {status === 'route' && (distanceText || durationText) && (
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">
            Driving: {distanceText} · {durationText}
          </span>
          <span className="text-gray-500 dark:text-[var(--text-tertiary)]">
            {originLabel} → {destLabel}
          </span>
        </div>
      )}
      {status === 'error' && (
        <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
      )}
    </div>
  )
}
