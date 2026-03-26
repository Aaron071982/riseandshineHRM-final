'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
const NYC = { lng: -74.006, lat: 40.7128, zoom: 11 }
const MAPBOX_TOKEN = typeof process.env.NEXT_PUBLIC_MAPBOX_TOKEN === 'string' ? process.env.NEXT_PUBLIC_MAPBOX_TOKEN : ''

const RANK_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#6b7280', '#0d9488'] as const

function formatDistance(miles: number | null): string {
  if (miles == null) return ''
  if (miles === 0 || miles < 0.1) return '< 0.1 mi'
  if (miles < 1) return `${miles.toFixed(1)} mi`
  if (miles <= 10) return `${miles.toFixed(1)} mi`
  return `${Math.round(miles)} mi`
}

function formatDriveTime(minutes: number | null): string {
  if (minutes == null) return ''
  if (minutes < 60) return `~${Math.round(minutes)} min drive`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (m === 0) return `~${h} hr drive`
  return `~${h} hr ${m} min drive`
}

export type ProximityRbt = {
  rbtProfileId: string
  firstName: string
  lastName: string
  fullAddress: string
  latitude: number | null
  longitude: number | null
  drivingDistanceMiles: number | null
  drivingDurationMinutes: number | null
  transportation: boolean | null
  languagesJson: unknown
}

type Props = {
  clientLat: number | null
  clientLng: number | null
  clientAddress: string
  rbts: ProximityRbt[]
  hoveredRbtIndex: number | null
  selectedRbtIndex: number | null
}

async function getRoute(
  clientLng: number,
  clientLat: number,
  rbtLng: number,
  rbtLat: number
): Promise<GeoJSON.Position[] | null> {
  if (!MAPBOX_TOKEN) return null
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${clientLng},${clientLat};${rbtLng},${rbtLat}?geometries=geojson&access_token=${MAPBOX_TOKEN}`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as { routes?: Array<{ geometry?: { coordinates?: GeoJSON.Position[] } }> }
    const coords = data.routes?.[0]?.geometry?.coordinates
    return coords && coords.length ? coords : null
  } catch {
    return null
  }
}

export default function SchedulingBetaProximityMap({
  clientLat,
  clientLng,
  clientAddress,
  rbts,
  hoveredRbtIndex,
  selectedRbtIndex,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const popupsRef = useRef<mapboxgl.Popup[]>([])
  const [routesLoading, setRoutesLoading] = useState(false)
  const routesLoadedRef = useRef(false)
  const requestIdRef = useRef(0)

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

    const onResize = () => map.resize()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      popupsRef.current.forEach((p) => p.remove())
      popupsRef.current = []
      const m = mapRef.current
      if (m) {
        try {
          if (m.isStyleLoaded()) {
            const style = m.getStyle()
            if (style?.sources) {
              Object.keys(style.sources).forEach((id) => {
                if (id.startsWith('route-')) {
                  try { m.removeLayer(id) } catch { /* ignore */ }
                  try { m.removeSource(id) } catch { /* ignore */ }
                }
              })
            }
          }
        } catch { /* style not loaded */ }
        m.remove()
      }
      mapRef.current = null
    }
  }, [])

  // When we have new results: clear previous, add client + RBT pins, fit bounds, fetch routes
  const hasResults = clientLat != null && clientLng != null && rbts.length > 0
  const rbtsWithCoords = rbts.filter((r): r is ProximityRbt & { latitude: number; longitude: number } => r.latitude != null && r.longitude != null)
  const rbtCoordIdsKey = useMemo(
    () => rbtsWithCoords.map((r) => r.rbtProfileId).join(','),
    [rbtsWithCoords]
  )

  useEffect(() => {
    const map = mapRef.current
    if (!map || !MAPBOX_TOKEN) return

    const clearMarkers = () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      popupsRef.current.forEach((p) => p.remove())
      popupsRef.current = []
    }

    const clearRouteLayers = () => {
      if (!map.isStyleLoaded()) return
      const style = map.getStyle()
      if (style?.sources) {
        Object.keys(style.sources).forEach((id) => {
          if (id.startsWith('route-')) {
            try { map.removeLayer(id) } catch { /* already removed */ }
            try { map.removeSource(id) } catch { /* already removed */ }
          }
        })
      }
    }

    const runWhenStyleLoaded = (fn: () => void) => {
      if (map.isStyleLoaded()) {
        fn()
      } else {
        map.once('load', fn)
      }
    }

    if (!hasResults) {
      clearMarkers()
      runWhenStyleLoaded(() => {
        clearRouteLayers()
        try { map.flyTo({ center: [NYC.lng, NYC.lat], zoom: NYC.zoom }) } catch { /* ignore */ }
      })
      routesLoadedRef.current = false
      return
    }

    clearMarkers()
    routesLoadedRef.current = false
    const clat = clientLat!
    const clng = clientLng!

    const allLngLats: [number, number][] = [[clng, clat]]
    rbtsWithCoords.forEach((r) => allLngLats.push([r.longitude!, r.latitude!]))

    const addPinsAndBounds = () => {
      try {
        clearRouteLayers()
        const clientEl = document.createElement('div')
        clientEl.className = 'client-pin'
        clientEl.innerHTML = '<span style="font-size:20px">🏠</span>'
        clientEl.style.cursor = 'pointer'
        const clientMarker = new mapboxgl.Marker({ element: clientEl, color: undefined })
          .setLngLat([clng, clat])
          .setPopup(
            new mapboxgl.Popup({ offset: 12 }).setHTML(
              `<div class="p-2"><strong>Client Location</strong><br/><span class="text-sm text-gray-600">${clientAddress || 'Address'}</span></div>`
            )
          )
          .addTo(map)
        markersRef.current.push(clientMarker)
        popupsRef.current.push(clientMarker.getPopup()!)

        rbtsWithCoords.forEach((rbt, idx) => {
          const rank = idx + 1
          const color = RANK_COLORS[idx] ?? RANK_COLORS[5]
          const el = document.createElement('div')
          el.className = 'rbt-pin'
          el.dataset.rankIndex = String(idx)
          el.style.cssText = `width:32px;height:32px;border-radius:50%;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;box-shadow:0 2px 4px rgba(0,0,0,0.3);cursor:pointer;`
          el.textContent = String(rank)
          const distStr = formatDistance(rbt.drivingDistanceMiles)
          const timeStr = formatDriveTime(rbt.drivingDurationMinutes)
          const transport = rbt.transportation ? 'Has Car' : 'No Car'
          const langs = Array.isArray(rbt.languagesJson) ? (rbt.languagesJson as string[]).join(', ') : ''
          const popupHtml = `
        <div class="p-2 min-w-[180px]">
          <strong>${rbt.firstName} ${rbt.lastName}</strong><br/>
          <span class="text-green-600 font-medium">#${rank} Closest</span><br/>
          ${distStr ? `${distStr}` : ''} ${timeStr ? ` · ${timeStr}` : ''}<br/>
          ${transport}<br/>
          ${langs ? `Languages: ${langs}` : ''}<br/>
          <a href="/admin/rbts/${rbt.rbtProfileId}" class="text-blue-600 hover:underline text-sm mt-1 inline-block">View Profile</a>
        </div>
      `
          const marker = new mapboxgl.Marker({ element: el, color: undefined })
            .setLngLat([rbt.longitude!, rbt.latitude!])
            .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML(popupHtml))
            .addTo(map)
          markersRef.current.push(marker)
          popupsRef.current.push(marker.getPopup()!)
        })

        const bounds = new mapboxgl.LngLatBounds(allLngLats[0], allLngLats[0])
        for (const ll of allLngLats) bounds.extend(ll)
        map.fitBounds(bounds, { padding: { top: 80, bottom: 80, left: 80, right: 80 }, maxZoom: 14 })
      } catch (_) {
        // Style not ready or map removed; ignore to avoid crashing the app
      }
    }

    runWhenStyleLoaded(addPinsAndBounds)

    const reqId = ++requestIdRef.current
    setRoutesLoading(true)
    const addRoutes = (routeCoordsList: (GeoJSON.Position[] | null)[]) => {
      if (!mapRef.current || requestIdRef.current !== reqId) return
      const mapInstance = mapRef.current
      if (!mapInstance.isStyleLoaded()) {
        mapInstance.once('load', () => addRoutes(routeCoordsList))
        return
      }
      for (let i = routeCoordsList.length - 1; i >= 0; i--) {
        const coords = routeCoordsList[i]
        if (!coords || coords.length < 2) continue
        const id = `route-${i}`
        const color = RANK_COLORS[i] ?? RANK_COLORS[5]
        if (!mapInstance.getSource(id)) {
          mapInstance.addSource(id, {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
          })
          mapInstance.addLayer({
            id,
            type: 'line',
            source: id,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': color,
              'line-width': 3,
              'line-opacity': 0.7,
              'line-dasharray': [2, 2],
            },
          })
        }
      }
      routesLoadedRef.current = true
      setRoutesLoading(false)
    }

    Promise.all(
      rbtsWithCoords.map((rbt) => getRoute(clng, clat, rbt.longitude!, rbt.latitude!))
    ).then(addRoutes)

    return () => {
      clearMarkers()
    }
    // rbtCoordIdsKey tracks rbtsWithCoords identity; listing rbtsWithCoords too triggers every render (new array from .filter).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable deps for map + routes
  }, [hasResults, clientLat, clientLng, clientAddress, rbtsWithCoords.length, rbtCoordIdsKey])

  // Route opacity by hover
  useEffect(() => {
    const map = mapRef.current
    if (!map || !routesLoadedRef.current || !map.isStyleLoaded()) return
    rbtsWithCoords.forEach((_, i) => {
      const layerId = `route-${i}`
      if (!map.getLayer(layerId)) return
      const opacity = hoveredRbtIndex === i ? 1 : hoveredRbtIndex !== null ? 0.2 : 0.7
      try { map.setPaintProperty(layerId, 'line-opacity', opacity) } catch { /* style not ready */ }
    })
  }, [hoveredRbtIndex, rbtsWithCoords])

  // Pin scale / popup by hover; fly on selected
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const pins = containerRef.current?.querySelectorAll('.rbt-pin')
    pins?.forEach((el, i) => {
      const isHovered = hoveredRbtIndex === i
      ;(el as HTMLElement).style.transform = isHovered ? 'scale(1.15)' : 'scale(1)'
    })
    if (hoveredRbtIndex !== null && markersRef.current[hoveredRbtIndex + 1]) {
      const marker = markersRef.current[hoveredRbtIndex + 1] as mapboxgl.Marker
      if (!marker.getPopup()?.isOpen()) marker.togglePopup()
    }
    if (hoveredRbtIndex === null) {
      markersRef.current.forEach((m) => m.getPopup()?.remove())
    }
  }, [hoveredRbtIndex])

  useEffect(() => {
    const map = mapRef.current
    if (!map || selectedRbtIndex == null || selectedRbtIndex < 0 || selectedRbtIndex >= rbtsWithCoords.length) return
    if (!map.isStyleLoaded()) return
    const rbt = rbtsWithCoords[selectedRbtIndex]
    try { map.flyTo({ center: [rbt.longitude!, rbt.latitude!], zoom: 14 }) } catch { /* style not ready */ }
  }, [selectedRbtIndex, rbtsWithCoords])

  if (!MAPBOX_TOKEN) {
    return (
      <div className="relative w-full min-h-[400px] h-[60vh] rounded-lg overflow-hidden border border-gray-200 dark:border-[var(--border-subtle)] flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm">
        Add NEXT_PUBLIC_MAPBOX_TOKEN to .env to show the map.
      </div>
    )
  }

  return (
    <div className="relative w-full min-h-[400px] h-[60vh] rounded-lg overflow-hidden border border-gray-200 dark:border-[var(--border-subtle)]">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      {routesLoading && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-gray-900/90 text-sm px-3 py-1.5 rounded shadow">
          Drawing routes…
        </div>
      )}
      <div className="absolute bottom-3 left-3 hidden md:block bg-white/95 dark:bg-gray-900/95 rounded-lg shadow p-2 text-xs space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Client</span>
        </div>
        {RANK_COLORS.map((color, i) => {
          const ord = i + 1
          const label = ord === 1 ? '1st' : ord === 2 ? '2nd' : ord === 3 ? '3rd' : ord === 4 ? '4th' : ord === 5 ? '5th' : '6th'
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span>{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
