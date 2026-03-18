'use client'

/**
 * FlightMap — interactive MapLibre GL map showing the flight path.
 * Uses CARTO Dark Matter vector tiles — free, no API key required.
 */

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// CARTO Dark Matter: free vector tiles, no API key
const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

interface RawEvent {
  lat?: number | null
  lon?: number | null
  timestamp?: string
  type?: string
}

interface FlightMapProps {
  rawEvents: RawEvent[]
  originIcao: string
  destIcao: string
}

export function FlightMap({ rawEvents, originIcao, destIcao }: FlightMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  const points = rawEvents
    .filter(e => e.lat != null && e.lon != null)
    .sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    })
    .map(e => [e.lon!, e.lat!] as [number, number])

  useEffect(() => {
    if (!containerRef.current || points.length < 2) return
    if (mapRef.current) return  // already initialised

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_STYLE,
      interactive: true,
      attributionControl: false,
    })
    mapRef.current = map

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right'
    )

    map.on('load', () => {
      // Flight path line
      map.addSource('flight-path', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: points },
        },
      })
      map.addLayer({
        id: 'flight-path-line',
        type: 'line',
        source: 'flight-path',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#22c55e',
          'line-width': 2.5,
          'line-opacity': 0.9,
        },
      })

      // Glow effect underneath
      map.addLayer({
        id: 'flight-path-glow',
        type: 'line',
        source: 'flight-path',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#22c55e',
          'line-width': 8,
          'line-opacity': 0.15,
          'line-blur': 4,
        },
      }, 'flight-path-line')

      // Start marker (origin)
      new maplibregl.Marker({ color: '#22c55e', scale: 0.7 })
        .setLngLat(points[0])
        .setPopup(new maplibregl.Popup({ closeButton: false, offset: 12 })
          .setHTML(`<span style="font-family:monospace;font-size:12px;font-weight:700">${originIcao}</span>`))
        .addTo(map)

      // End marker (destination)
      new maplibregl.Marker({ color: '#16a34a', scale: 0.7 })
        .setLngLat(points[points.length - 1])
        .setPopup(new maplibregl.Popup({ closeButton: false, offset: 12 })
          .setHTML(`<span style="font-family:monospace;font-size:12px;font-weight:700">${destIcao}</span>`))
        .addTo(map)

      // Fit map to the path with padding
      const lngs = points.map(p => p[0])
      const lats = points.map(p => p[1])
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: { top: 40, bottom: 40, left: 60, right: 60 }, duration: 0 }
      )
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (points.length < 2) return null

  return (
    <div className="relative rounded-xl overflow-hidden border border-border">
      {/* Route label */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm rounded-md px-2.5 py-1 pointer-events-none">
        <span className="text-xs font-mono font-bold text-white">{originIcao}</span>
        <span className="text-green-400 text-xs">→</span>
        <span className="text-xs font-mono font-bold text-white">{destIcao}</span>
      </div>
      <div ref={containerRef} style={{ height: 260 }} />
    </div>
  )
}
