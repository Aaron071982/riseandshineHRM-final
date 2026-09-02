'use client'

import { useEffect, useMemo, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type {
  MapClientEntity,
  MapTherapistEntity,
} from '@/lib/crm/therapistClientMap/types'

const MAPBOX_TOKEN =
  typeof process.env.NEXT_PUBLIC_MAPBOX_TOKEN === 'string'
    ? process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    : ''

const NYC = { lng: -74.006, lat: 40.7128, zoom: 9 }

const CLIENT_RADIUS = 9
const CLIENT_RADIUS_HIGHLIGHT = 12
const THERAPIST_ICON_SIZE = 1.2
const THERAPIST_ICON_SIZE_HIGHLIGHT = 1.45
const TRIANGLE_CANVAS_SIZE = 36

export type MapSelection = {
  type: 'therapist' | 'client'
  id: string
} | null

type Props = {
  therapists: MapTherapistEntity[]
  clients: MapClientEntity[]
  selected: MapSelection
  highlightedIds: Set<string>
  onSelect: (sel: MapSelection) => void
}

function buildClientGeoJson(clients: MapClientEntity[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: clients.map((c) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [c.lng, c.lat],
      },
      properties: {
        entityType: 'client',
        id: c.id,
        name: c.name,
        markerHex: c.markerHex,
      },
    })),
  }
}

function buildTherapistGeoJson(
  therapists: MapTherapistEntity[]
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: therapists.map((t) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [t.lng, t.lat],
      },
      properties: {
        entityType: 'therapist',
        id: t.id,
        name: t.name,
        markerColor: t.markerColor,
      },
    })),
  }
}

function createTriangleImageData(
  fill: string,
  size = TRIANGLE_CANVAS_SIZE
): ImageData | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const pad = 2
  ctx.clearRect(0, 0, size, size)
  ctx.beginPath()
  ctx.moveTo(size / 2, pad)
  ctx.lineTo(size - pad, size - pad)
  ctx.lineTo(pad, size - pad)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()

  return ctx.getImageData(0, 0, size, size)
}

export default function TherapistClientMap({
  therapists,
  clients,
  selected,
  highlightedIds,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const iconsLoadedRef = useRef(false)

  const clientGeoJson = useMemo(() => buildClientGeoJson(clients), [clients])
  const therapistGeoJson = useMemo(
    () => buildTherapistGeoJson(therapists),
    [therapists]
  )

  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      center: [NYC.lng, NYC.lat],
      zoom: NYC.zoom,
      style: `https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${MAPBOX_TOKEN}`,
      attributionControl: false,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.on('load', () => {
      const green = createTriangleImageData('#16a34a')
      const red = createTriangleImageData('#dc2626')
      if (green && red) {
        map.addImage('therapist-green', green, { pixelRatio: 2 })
        map.addImage('therapist-red', red, { pixelRatio: 2 })
        iconsLoadedRef.current = true
      }

      map.addSource('clients', {
        type: 'geojson',
        data: clientGeoJson,
      })

      map.addSource('therapists', {
        type: 'geojson',
        data: therapistGeoJson,
      })

      map.addLayer({
        id: 'client-points',
        type: 'circle',
        source: 'clients',
        paint: {
          'circle-color': ['get', 'markerHex'],
          'circle-radius': CLIENT_RADIUS,
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      })

      map.addLayer({
        id: 'therapist-points',
        type: 'symbol',
        source: 'therapists',
        layout: {
          'icon-image': [
            'match',
            ['get', 'markerColor'],
            'green',
            'therapist-green',
            'red',
            'therapist-red',
            'therapist-red',
          ],
          'icon-size': THERAPIST_ICON_SIZE,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      })

      const bindClick = (layerId: string) => {
        map.on('click', layerId, (e) => {
          const f = e.features?.[0]
          if (!f?.properties) return
          onSelectRef.current({
            type: f.properties.entityType as 'therapist' | 'client',
            id: String(f.properties.id),
          })
        })
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = ''
        })
      }
      bindClick('client-points')
      bindClick('therapist-points')
    })

    return () => {
      map.remove()
      mapRef.current = null
      iconsLoadedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    const clientSrc = map.getSource('clients') as mapboxgl.GeoJSONSource | undefined
    const therapistSrc = map.getSource('therapists') as mapboxgl.GeoJSONSource | undefined
    clientSrc?.setData(clientGeoJson)
    therapistSrc?.setData(therapistGeoJson)

    const allFeatures = [...clientGeoJson.features, ...therapistGeoJson.features]
    if (allFeatures.length > 0) {
      const bounds = new mapboxgl.LngLatBounds()
      for (const f of allFeatures) {
        if (f.geometry.type === 'Point') {
          bounds.extend(f.geometry.coordinates as [number, number])
        }
      }
      try {
        map.fitBounds(bounds, {
          padding: 48,
          maxZoom: 11,
          duration: 0,
        })
      } catch {
        /* empty bounds */
      }
    }
  }, [clientGeoJson, therapistGeoJson])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    const dim = selected && highlightedIds.size > 0 ? 0.25 : 1
    const hi = [...highlightedIds]

    if (map.getLayer('client-points')) {
      map.setPaintProperty('client-points', 'circle-opacity', [
        'case',
        ['in', ['get', 'id'], ['literal', hi]],
        1,
        dim,
      ])
      map.setPaintProperty('client-points', 'circle-radius', [
        'case',
        ['in', ['get', 'id'], ['literal', hi]],
        CLIENT_RADIUS_HIGHLIGHT,
        CLIENT_RADIUS,
      ])
    }

    if (map.getLayer('therapist-points')) {
      map.setLayoutProperty('therapist-points', 'icon-size', [
        'case',
        ['in', ['get', 'id'], ['literal', hi]],
        THERAPIST_ICON_SIZE_HIGHLIGHT,
        THERAPIST_ICON_SIZE,
      ])
      map.setPaintProperty('therapist-points', 'icon-opacity', [
        'case',
        ['in', ['get', 'id'], ['literal', hi]],
        1,
        dim,
      ])
    }
  }, [selected, highlightedIds])

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full min-h-[480px] items-center justify-center bg-line-2/30 text-sm text-quiet">
        Add NEXT_PUBLIC_MAPBOX_TOKEN to show the map.
      </div>
    )
  }

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-[#e8edf2]">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}

export function formatMapDistance(miles: number | null): string {
  if (miles == null) return '—'
  if (miles < 0.1) return '< 0.1 mi'
  return `${miles.toFixed(1)} mi`
}
