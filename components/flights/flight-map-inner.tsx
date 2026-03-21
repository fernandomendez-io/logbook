'use client'

/**
 * FlightMapInner — MapLibre GL map (no SSR).
 * Imported dynamically via flight-map.tsx with ssr: false.
 *
 * Features:
 * - Altitude-gradient track coloring (dark green at low → bright green at cruise)
 * - Heading arrows every ~15 track points
 * - Custom HTML airport badge markers with popups
 * - Great-circle arc fallback when no track data (dashed line between airports)
 * - Taller map (340px)
 */

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { TrackPoint } from '@/lib/api/flightaware'

// CARTO Dark Matter: free vector tiles, no API key
const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

interface Coord { lat: number; lon: number }

interface FlightMapInnerProps {
  trackPoints: TrackPoint[]
  originIcao: string
  destIcao: string
  originCoords?: Coord
  destCoords?: Coord
}

/** Create a custom airport badge HTML element */
function makeAirportEl(code: string, isOrigin: boolean): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = `
    display: flex; align-items: center; gap: 4px;
    background: rgba(0,0,0,0.85);
    border: 1.5px solid ${isOrigin ? '#4ade80' : '#16a34a'};
    border-radius: 6px;
    padding: 3px 8px;
    cursor: default;
    pointer-events: none;
  `
  const dot = document.createElement('div')
  dot.style.cssText = `
    width: 7px; height: 7px; border-radius: 50%;
    background: ${isOrigin ? '#4ade80' : '#16a34a'};
    flex-shrink: 0;
  `
  const label = document.createElement('span')
  label.textContent = code
  label.style.cssText = `
    font-family: monospace; font-size: 11px; font-weight: 700;
    color: ${isOrigin ? '#4ade80' : '#86efac'};
    letter-spacing: 0.5px;
  `
  el.appendChild(dot)
  el.appendChild(label)
  return el
}

/** Build a GeoJSON FeatureCollection of line segments colored by altitude */
function buildAltitudeGeoJSON(pts: TrackPoint[]) {
  const maxAlt = Math.max(...pts.map(p => p.alt), 1)

  const features = pts.slice(0, -1).map((p, i) => {
    const next = pts[i + 1]
    const altFrac = Math.min(1, p.alt / maxAlt)
    return {
      type: 'Feature' as const,
      properties: { altFrac, alt: p.alt, gspeed: p.gspeed },
      geometry: {
        type: 'LineString' as const,
        coordinates: [[p.lon, p.lat], [next.lon, next.lat]],
      },
    }
  })

  return { type: 'FeatureCollection' as const, features }
}

/** Alt fraction → interpolated color (dark green → bright yellow-green) */
function altColor(frac: number): string {
  const r0 = 22, g0 = 101, b0 = 52    // #166534
  const r1 = 34, g1 = 197, b1 = 94    // #22c55e
  const r2 = 134, g2 = 239, b2 = 172  // #86efac
  let r, g, b
  if (frac < 0.5) {
    const t = frac * 2
    r = Math.round(r0 + (r1 - r0) * t)
    g = Math.round(g0 + (g1 - g0) * t)
    b = Math.round(b0 + (b1 - b0) * t)
  } else {
    const t = (frac - 0.5) * 2
    r = Math.round(r1 + (r2 - r1) * t)
    g = Math.round(g1 + (g2 - g1) * t)
    b = Math.round(b1 + (b2 - b1) * t)
  }
  return `rgb(${r},${g},${b})`
}

/** Generate intermediate points along a great-circle arc (for dashed fallback line).
 *  Returns array of [lon, lat] tuples. */
function greatCircleArc(
  origin: Coord,
  dest: Coord,
  steps = 40,
): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI

  const lat1 = toRad(origin.lat)
  const lon1 = toRad(origin.lon)
  const lat2 = toRad(dest.lat)
  const lon2 = toRad(dest.lon)

  const points: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    const A = Math.sin((1 - f) * Math.acos(
      Math.sin(lat1) * Math.sin(lat2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)
    )) / Math.sin(Math.acos(
      Math.sin(lat1) * Math.sin(lat2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)
    ))
    const B = Math.sin(f * Math.acos(
      Math.sin(lat1) * Math.sin(lat2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)
    )) / Math.sin(Math.acos(
      Math.sin(lat1) * Math.sin(lat2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)
    ))
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2)
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))
    const lon = toDeg(Math.atan2(y, x))
    points.push([lon, lat])
  }
  return points
}

export default function FlightMapInner({
  trackPoints,
  originIcao,
  destIcao,
  originCoords,
  destCoords,
}: FlightMapInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  const pts = trackPoints
    .filter(p => p.lat != null && p.lon != null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  const hasTrack = pts.length >= 2
  const hasFallback = !hasTrack && !!originCoords && !!destCoords

  useEffect(() => {
    if (!containerRef.current) return
    if (!hasTrack && !hasFallback) return
    if (mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_STYLE,
      interactive: true,
      attributionControl: false,
    })
    mapRef.current = map

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('load', () => {
      if (hasTrack) {
        const maxAlt = Math.max(...pts.map(p => p.alt), 1)

        // ── Altitude-gradient segments ────────────────────────────────────────
        const geoJSON = buildAltitudeGeoJSON(pts)
        map.addSource('flight-path', { type: 'geojson', data: geoJSON })

        // Glow layer
        map.addLayer({
          id: 'flight-glow',
          type: 'line',
          source: 'flight-path',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#22c55e',
            'line-width': 10,
            'line-opacity': 0.12,
            'line-blur': 6,
          },
        })

        // Main track — color interpolated by altFrac property
        map.addLayer({
          id: 'flight-track',
          type: 'line',
          source: 'flight-path',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': [
              'interpolate', ['linear'],
              ['get', 'altFrac'],
              0,   '#166534',
              0.3, '#22c55e',
              0.7, '#4ade80',
              1,   '#86efac',
            ],
            'line-width': [
              'interpolate', ['linear'], ['get', 'altFrac'],
              0, 2,
              1, 3,
            ],
            'line-opacity': 0.95,
          },
        })

        // ── Heading arrows every ~15 points ──────────────────────────────────
        const arrowStep = Math.max(1, Math.floor(pts.length / 15))
        pts.forEach((p, i) => {
          if (i === 0 || i === pts.length - 1 || i % arrowStep !== 0) return
          if (!p.heading) return

          const altFrac = Math.min(1, p.alt / maxAlt)
          const color = altColor(altFrac)

          const el = document.createElement('div')
          el.style.cssText = `
            width: 0; height: 0;
            border-left: 4px solid transparent;
            border-right: 4px solid transparent;
            border-bottom: 10px solid ${color};
            opacity: 0.7;
            transform: rotate(${p.heading}deg);
            transform-origin: center bottom;
          `
          new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([p.lon, p.lat])
            .addTo(map)
        })

        // ── Airport markers ───────────────────────────────────────────────────
        new maplibregl.Marker({ element: makeAirportEl(originIcao, true), anchor: 'center' })
          .setLngLat([pts[0].lon, pts[0].lat])
          .addTo(map)

        new maplibregl.Marker({ element: makeAirportEl(destIcao, false), anchor: 'center' })
          .setLngLat([pts[pts.length - 1].lon, pts[pts.length - 1].lat])
          .addTo(map)

        // ── Fit bounds ────────────────────────────────────────────────────────
        const lngs = pts.map(p => p.lon)
        const lats = pts.map(p => p.lat)
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: { top: 50, bottom: 50, left: 80, right: 80 }, duration: 0 }
        )
      } else if (hasFallback && originCoords && destCoords) {
        // ── Great-circle arc fallback ──────────────────────────────────────────
        const arcCoords = greatCircleArc(originCoords, destCoords)

        map.addSource('gc-arc', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: arcCoords },
          },
        })

        // Dashed white arc
        map.addLayer({
          id: 'gc-arc-line',
          type: 'line',
          source: 'gc-arc',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#ffffff',
            'line-width': 1.5,
            'line-opacity': 0.35,
            'line-dasharray': [4, 4],
          },
        })

        // Airport markers at coord positions
        new maplibregl.Marker({ element: makeAirportEl(originIcao, true), anchor: 'center' })
          .setLngLat([originCoords.lon, originCoords.lat])
          .addTo(map)

        new maplibregl.Marker({ element: makeAirportEl(destIcao, false), anchor: 'center' })
          .setLngLat([destCoords.lon, destCoords.lat])
          .addTo(map)

        // Fit to the arc extents
        const lons = arcCoords.map(c => c[0])
        const lats = arcCoords.map(c => c[1])
        map.fitBounds(
          [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
          { padding: { top: 60, bottom: 60, left: 100, right: 100 }, duration: 0 }
        )
      }
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!hasTrack && !hasFallback) return null

  return (
    <div className="relative rounded-xl overflow-hidden border border-border">
      {/* Route label */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/75 backdrop-blur-sm rounded-md px-2.5 py-1.5 pointer-events-none">
        <span className="text-xs font-mono font-bold text-white">{originIcao}</span>
        <span className="text-green-400 text-xs">→</span>
        <span className="text-xs font-mono font-bold text-white">{destIcao}</span>
        {!hasTrack && (
          <span className="text-xs text-white/30 ml-1">est. route</span>
        )}
      </div>
      <div ref={containerRef} style={{ height: 340 }} />
    </div>
  )
}
