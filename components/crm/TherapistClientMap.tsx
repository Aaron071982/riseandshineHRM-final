'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type {
  MapAssignmentPair,
  MapClientEntity,
  MapTherapistEntity,
} from '@/lib/crm/therapistClientMap/types'
import { haversineMiles } from '@/lib/scheduling-beta/zipToCoord'

const MAPBOX_TOKEN =
  typeof process.env.NEXT_PUBLIC_MAPBOX_TOKEN === 'string'
    ? process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    : ''

const NYC = { lng: -74.006, lat: 40.7128, zoom: 9 }

export const THERAPIST_COLORS = { green: '#22c55e', blue: '#3b82f6' } as const
export const CLIENT_COLORS = { orange: '#f97316', black: '#374151' } as const

export type MapSelection = {
  type: 'therapist' | 'client'
  id: string
} | null

type Props = {
  therapists: MapTherapistEntity[]
  clients: MapClientEntity[]
  pairs: MapAssignmentPair[]
  showPairLines: boolean
  selected: MapSelection
  highlightedIds: Set<string>
  onSelect: (sel: MapSelection) => void
}

function buildGeoJson(
  therapists: MapTherapistEntity[],
  clients: MapClientEntity[]
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      ...therapists.map((t) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [t.lng, t.lat],
        },
        properties: {
          entityType: 'therapist',
          id: t.id,
          markerColor: t.markerColor,
          hasCapacity: t.hasCapacity ? 1 : 0,
        },
      })),
      ...clients.map((c) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [c.lng, c.lat],
        },
        properties: {
          entityType: 'client',
          id: c.id,
          markerColor: c.markerColor,
        },
      })),
    ],
  }
}

function buildLinesGeoJson(
  pairs: MapAssignmentPair[],
  therapists: MapTherapistEntity[],
  clients: MapClientEntity[],
  highlightKey: string | null
): GeoJSON.FeatureCollection {
  const tById = new Map(therapists.map((t) => [t.id, t]))
  const cById = new Map(clients.map((c) => [c.id, c]))
  const features: GeoJSON.Feature[] = []
  for (const p of pairs) {
    const t = tById.get(p.therapistId)
    const c = cById.get(p.clientId)
    if (!t || !c) continue
    const key = `${p.clientId}:${p.therapistId}`
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [t.lng, t.lat],
          [c.lng, c.lat],
        ],
      },
      properties: {
        key,
        miles: Math.round(haversineMiles(c.lat, c.lng, t.lat, t.lng) * 10) / 10,
        highlighted: highlightKey === key ? 1 : 0,
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

export default function TherapistClientMap({
  therapists,
  clients,
  pairs,
  showPairLines,
  selected,
  highlightedIds,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  const geoJson = useMemo(
    () => buildGeoJson(therapists, clients),
    [therapists, clients]
  )

  const highlightPairKey = useMemo(() => {
    if (!selected) return null
    if (selected.type === 'therapist') {
      const p = pairs.find((x) => x.therapistId === selected.id)
      return p ? `${p.clientId}:${p.therapistId}` : null
    }
    const p = pairs.find((x) => x.clientId === selected.id)
    return p ? `${p.clientId}:${p.therapistId}` : null
  }, [selected, pairs])

  const linesGeoJson = useMemo(
    () => buildLinesGeoJson(pairs, therapists, clients, highlightPairKey),
    [pairs, therapists, clients, highlightPairKey]
  )

  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      center: [NYC.lng, NYC.lat],
      zoom: NYC.zoom,
      style: `https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${MAPBOX_TOKEN}`,
    })
    mapRef.current = map

    map.on('load', () => {
      map.addSource('pair-lines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addSource('entities', {
        type: 'geojson',
        data: geoJson,
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 48,
      })

      map.addLayer({
        id: 'pair-lines',
        type: 'line',
        source: 'pair-lines',
        layout: { visibility: showPairLines ? 'visible' : 'none' },
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'highlighted'], 1],
            '#c45a1a',
            '#94a3b8',
          ],
          'line-width': ['case', ['==', ['get', 'highlighted'], 1], 3, 1.5],
          'line-opacity': [
            'case',
            ['==', ['get', 'highlighted'], 1],
            0.9,
            0.45,
          ],
        },
      })

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'entities',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#c45a1a',
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            18,
            10,
            24,
            30,
            30,
          ],
          'circle-opacity': 0.85,
        },
      })

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'entities',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 13,
        },
        paint: { 'text-color': '#ffffff' },
      })

      map.addLayer({
        id: 'client-points',
        type: 'circle',
        source: 'entities',
        filter: [
          'all',
          ['!', ['has', 'point_count']],
          ['==', ['get', 'entityType'], 'client'],
        ],
        paint: {
          'circle-color': [
            'match',
            ['get', 'markerColor'],
            'orange',
            CLIENT_COLORS.orange,
            CLIENT_COLORS.black,
          ],
          'circle-radius': 7,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      map.addLayer({
        id: 'therapist-points',
        type: 'circle',
        source: 'entities',
        filter: [
          'all',
          ['!', ['has', 'point_count']],
          ['==', ['get', 'entityType'], 'therapist'],
        ],
        paint: {
          'circle-color': [
            'match',
            ['get', 'markerColor'],
            'green',
            THERAPIST_COLORS.green,
            THERAPIST_COLORS.blue,
          ],
          'circle-radius': [
            'case',
            ['==', ['get', 'hasCapacity'], 1],
            11,
            9,
          ],
          'circle-stroke-width': [
            'case',
            ['==', ['get', 'hasCapacity'], 1],
            3,
            2,
          ],
          'circle-stroke-color': '#ffffff',
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
      bindClick('therapist-points')
      bindClick('client-points')

      map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['clusters'],
        })
        const clusterId = features[0]?.properties?.cluster_id
        const source = map.getSource('entities') as mapboxgl.GeoJSONSource
        if (clusterId == null) return
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom == null) return
          const geometry = features[0]?.geometry
          if (geometry?.type !== 'Point') return
          map.easeTo({
            center: geometry.coordinates as [number, number],
            zoom,
          })
        })
      })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    const src = map.getSource('entities') as mapboxgl.GeoJSONSource | undefined
    src?.setData(geoJson)

    if (geoJson.features.length > 0) {
      const bounds = new mapboxgl.LngLatBounds()
      for (const f of geoJson.features) {
        if (f.geometry.type === 'Point') {
          bounds.extend(f.geometry.coordinates as [number, number])
        }
      }
      try {
        map.fitBounds(bounds, {
          padding: 60,
          maxZoom: 11,
          duration: 0,
        })
      } catch {
        /* empty bounds */
      }
    }
  }, [geoJson])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    const src = map.getSource('pair-lines') as mapboxgl.GeoJSONSource | undefined
    src?.setData(linesGeoJson)
    if (map.getLayer('pair-lines')) {
      map.setLayoutProperty(
        'pair-lines',
        'visibility',
        showPairLines ? 'visible' : 'none'
      )
    }
  }, [linesGeoJson, showPairLines])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    const dim = selected && highlightedIds.size > 0 ? 0.3 : 0.95
    const hi = [...highlightedIds]
    for (const layer of ['therapist-points', 'client-points'] as const) {
      if (!map.getLayer(layer)) continue
      map.setPaintProperty(layer, 'circle-opacity', [
        'case',
        ['in', ['get', 'id'], ['literal', hi]],
        1,
        dim,
      ])
    }
  }, [selected, highlightedIds])

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex min-h-[480px] items-center justify-center rounded-xl border border-line bg-line-2/30 text-sm text-quiet">
        Add NEXT_PUBLIC_MAPBOX_TOKEN to show the map.
      </div>
    )
  }

  return (
    <div className="relative min-h-[520px] overflow-hidden rounded-xl border border-line bg-[#faf6f1]">
      <div
        ref={containerRef}
        className="absolute inset-0 h-full min-h-[520px] w-full"
      />
    </div>
  )
}

export function formatMapDistance(miles: number | null): string {
  if (miles == null) return '—'
  if (miles < 0.1) return '< 0.1 mi'
  return `${miles.toFixed(1)} mi`
}
