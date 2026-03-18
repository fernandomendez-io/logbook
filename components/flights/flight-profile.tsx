'use client'

import { useState } from 'react'

export interface AirspaceTransition {
  timestamp: string
  exited:    string | null
  entered:   string | null
}

interface RawEvent {
  alt?:       number | null
  timestamp?: string
}

interface FlightProfileProps {
  outUtc:              string | null
  offUtc:              string | null
  onUtc:               string | null
  inUtc:               string | null
  descentStartUtc:     string | null
  cruiseAltFt:         number | null
  cruiseGspeedKts:     number | null
  airspaceTransitions: AirspaceTransition[]
  departureRunway:     string | null
  landingRunway:       string | null
  rawEvents?:          RawEvent[]
}

// SVG constants
const W = 800
const H = 200
const PAD_X = 48
const GROUND_Y = 172
const CRUISE_Y = 38

function toMs(iso: string | null | undefined): number {
  return iso ? new Date(iso).getTime() : 0
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toISOString().slice(11, 16) + 'Z'
}

function dur(a: string | null, b: string | null): string {
  if (!a || !b) return ''
  const diff = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)
  if (diff <= 0) return ''
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// Catmull-Rom spline segment → cubic bezier control points
function catmullToCubic(
  p0: [number, number], p1: [number, number],
  p2: [number, number], p3: [number, number]
): [[number, number], [number, number]] {
  return [
    [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
    [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
  ]
}

// Build SVG path from catmull-rom points
function catmullPath(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  const parts: string[] = [`M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`]
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const [cp1, cp2] = catmullToCubic(p0, p1, p2, p3)
    parts.push(`C ${cp1[0].toFixed(1)},${cp1[1].toFixed(1)} ${cp2[0].toFixed(1)},${cp2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`)
  }
  return parts.join(' ')
}

// Linear interpolate altitude Y at a given ms from sorted alt points
function interpAltY(ms: number, pts: { ms: number; y: number }[]): number {
  if (pts.length === 0) return GROUND_Y
  if (ms <= pts[0].ms) return pts[0].y
  if (ms >= pts[pts.length - 1].ms) return pts[pts.length - 1].y
  for (let i = 0; i < pts.length - 1; i++) {
    if (ms >= pts[i].ms && ms <= pts[i + 1].ms) {
      const t = (ms - pts[i].ms) / (pts[i + 1].ms - pts[i].ms)
      return pts[i].y + t * (pts[i + 1].y - pts[i].y)
    }
  }
  return GROUND_Y
}

export function FlightProfile({
  outUtc, offUtc, onUtc, inUtc,
  descentStartUtc,
  cruiseAltFt, cruiseGspeedKts,
  airspaceTransitions,
  departureRunway, landingRunway,
  rawEvents = [],
}: FlightProfileProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  // Timeline boundaries — use OUT/IN with fallback to OFF/ON
  const startMs = toMs(outUtc || offUtc)
  const endMs   = toMs(inUtc  || onUtc)
  if (!startMs || !endMs || endMs <= startMs) return null

  const span = endMs - startMs

  // Convert timestamp to SVG x
  function tx(iso: string | null | undefined): number {
    if (!iso) return PAD_X
    const ms = toMs(iso)
    return PAD_X + ((ms - startMs) / span) * (W - PAD_X * 2)
  }

  const xOut  = PAD_X
  const xOff  = tx(offUtc)
  const xDesc = descentStartUtc ? tx(descentStartUtc) : W - PAD_X - (W - PAD_X * 2) * 0.22
  const xOn   = tx(onUtc)
  const xIn   = W - PAD_X
  const xCruiseMid = (xOff + xDesc) / 2

  // ─── Real altitude data ───────────────────────────────────────────────────
  const altPoints = rawEvents
    .filter(e => e.alt != null && e.timestamp)
    .map(e => ({ ms: toMs(e.timestamp), alt: e.alt! }))
    .filter(e => e.ms >= startMs && e.ms <= endMs)
    .sort((a, b) => a.ms - b.ms)

  const useRealAlt = altPoints.length >= 3
  const maxAlt = useRealAlt ? Math.max(...altPoints.map(p => p.alt)) : 1
  const altToY = (alt: number) => GROUND_Y - (alt / maxAlt) * (GROUND_Y - CRUISE_Y)

  // Map alt points to SVG coordinates (downsample if very dense)
  const svgAltPts: [number, number][] = (() => {
    if (!useRealAlt) return []
    // Downsample to max ~120 points for smooth but lightweight path
    const step = Math.max(1, Math.floor(altPoints.length / 120))
    const sampled = altPoints.filter((_, i) => i % step === 0 || i === altPoints.length - 1)
    return sampled.map(p => [
      PAD_X + ((p.ms - startMs) / span) * (W - PAD_X * 2),
      altToY(p.alt),
    ])
  })()

  // Altitude Y lookup for phase dots
  const altYLookup = altPoints.map(p => ({
    ms: p.ms,
    y: altToY(p.alt),
  }))

  function phaseY(iso: string | null | undefined): number {
    if (!useRealAlt || !iso) return GROUND_Y
    const ms = toMs(iso)
    return interpAltY(ms, altYLookup)
  }

  // ─── Paths ────────────────────────────────────────────────────────────────
  let path: string
  let fillPath: string

  if (useRealAlt && svgAltPts.length >= 2) {
    // Prepend and append ground anchor points for smooth ramp
    const allPts: [number, number][] = [
      [xOut, GROUND_Y],
      ...svgAltPts,
      [xIn, GROUND_Y],
    ]
    path = catmullPath(allPts)
    fillPath = path + ` L ${xIn} ${H - 10} L ${xOut} ${H - 10} Z`
  } else {
    // Fallback: cubic bezier hill
    const bezier = [
      `M ${xOut} ${GROUND_Y}`,
      `C ${xOut + 20} ${GROUND_Y}, ${xOff - 20} ${CRUISE_Y + 30}, ${xOff} ${CRUISE_Y + 10}`,
      `C ${xOff + 40} ${CRUISE_Y}, ${xDesc - 40} ${CRUISE_Y}, ${xDesc} ${CRUISE_Y + 10}`,
      `C ${xDesc + 20} ${CRUISE_Y + 30}, ${xOn - 20} ${GROUND_Y}, ${xOn} ${GROUND_Y}`,
      `L ${xIn} ${GROUND_Y}`,
    ].join(' ')
    path = bezier
    fillPath = bezier + ` L ${xIn} ${H - 10} L ${xOut} ${H - 10} Z`
  }

  // ─── Phase dots ───────────────────────────────────────────────────────────
  const offY  = useRealAlt ? phaseY(offUtc)          : CRUISE_Y + 10
  const descY = useRealAlt ? phaseY(descentStartUtc) : CRUISE_Y + 10
  const onY   = useRealAlt ? phaseY(onUtc)           : GROUND_Y
  const cruiseY = useRealAlt
    ? (maxAlt > 0 ? altToY(maxAlt) : CRUISE_Y)
    : CRUISE_Y

  const phases = [
    { id: 'out',    x: xOut,       y: GROUND_Y, label: 'OUT',     time: outUtc,          next: offUtc,  desc: 'Gate departure' },
    { id: 'off',    x: xOff,       y: offY,     label: 'OFF',     time: offUtc,          next: onUtc,   desc: 'Wheels off' },
    { id: 'cruise', x: xCruiseMid, y: cruiseY,  label: 'Cruise',  time: null,            next: null,    desc: 'Cruise phase' },
    { id: 'desc',   x: xDesc,      y: descY,    label: 'Descent', time: descentStartUtc, next: onUtc,   desc: 'Top of descent' },
    { id: 'on',     x: xOn,        y: onY,      label: 'ON',      time: onUtc,           next: inUtc,   desc: 'Wheels on' },
    { id: 'in',     x: xIn,        y: GROUND_Y, label: 'IN',      time: inUtc,           next: null,    desc: 'Gate arrival' },
  ]

  // Airspace transitions
  const airspaceBadges = airspaceTransitions
    .filter(t => t.entered && t.timestamp)
    .map(t => ({ label: t.entered!, x: tx(t.timestamp), time: t.timestamp }))

  return (
    <div className="relative w-full select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 'auto', display: 'block' }}
      >
        <defs>
          <linearGradient id="profileGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#22c55e" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Ground line */}
        <line x1={PAD_X} y1={GROUND_Y} x2={W - PAD_X} y2={GROUND_Y}
              stroke="#374151" strokeWidth="1" />

        {/* Airspace vertical guide lines */}
        {airspaceBadges.map((ab, i) => (
          <line key={i} x1={ab.x} y1={CRUISE_Y + 5} x2={ab.x} y2={GROUND_Y}
                stroke="#22c55e" strokeWidth="0.5" strokeOpacity="0.2" strokeDasharray="3 3" />
        ))}

        {/* Descent start guide */}
        {descentStartUtc && (
          <line x1={xDesc} y1={CRUISE_Y + 5} x2={xDesc} y2={GROUND_Y}
                stroke="#22c55e" strokeWidth="0.5" strokeOpacity="0.15" strokeDasharray="2 4" />
        )}

        {/* Fill */}
        <path d={fillPath} fill="url(#profileGrad)" />

        {/* Profile curve */}
        <path d={path} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Runway labels near ground */}
        {departureRunway && (
          <text x={xOff} y={GROUND_Y + 16} textAnchor="middle"
                fontSize="9" fill="#4ade80" fontFamily="monospace" opacity="0.7">
            {departureRunway}
          </text>
        )}
        {landingRunway && (
          <text x={xOn} y={GROUND_Y + 16} textAnchor="middle"
                fontSize="9" fill="#4ade80" fontFamily="monospace" opacity="0.7">
            {landingRunway}
          </text>
        )}

        {/* Cruise info badge */}
        {(cruiseAltFt || cruiseGspeedKts) && (
          <g>
            <rect x={xCruiseMid - 42} y={cruiseY - 22} width="84" height="16"
                  rx="4" fill="#0f1a0f" stroke="#22c55e" strokeWidth="0.5" strokeOpacity="0.4" />
            <text x={xCruiseMid} y={cruiseY - 11} textAnchor="middle"
                  fontSize="9" fill="#4ade80" fontFamily="monospace">
              {cruiseAltFt ? `FL${Math.round(cruiseAltFt / 100)}` : ''}
              {cruiseAltFt && cruiseGspeedKts ? ' · ' : ''}
              {cruiseGspeedKts ? `${cruiseGspeedKts}kt` : ''}
            </text>
          </g>
        )}

        {/* Phase dots + hover targets */}
        {phases.map(p => (
          <g key={p.id}
             onMouseEnter={() => setHovered(p.id)}
             onMouseLeave={() => setHovered(null)}
             style={{ cursor: 'default' }}>
            <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
            <circle cx={p.x} cy={p.y} r={hovered === p.id ? 5 : 3.5}
                    fill={hovered === p.id ? '#22c55e' : '#166534'}
                    stroke="#22c55e" strokeWidth="1.5"
                    style={{ transition: 'r 0.1s' }} />
            <text x={p.x} y={p.id === 'cruise' ? p.y - 6 : GROUND_Y + 28}
                  textAnchor="middle" fontSize="8.5" fill="#6b7280" fontFamily="monospace">
              {p.label}
            </text>
          </g>
        ))}

        {/* Airspace center badges along bottom strip */}
        {airspaceBadges.map((ab, i) => (
          <g key={i}>
            <rect x={ab.x - 18} y={H - 24} width="36" height="13"
                  rx="3" fill="#0d1f10" stroke="#22c55e" strokeWidth="0.5" strokeOpacity="0.5" />
            <text x={ab.x} y={H - 14} textAnchor="middle"
                  fontSize="8" fill="#86efac" fontFamily="monospace">
              {ab.label.length > 5 ? ab.label.slice(0, 5) : ab.label}
            </text>
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {hovered && (() => {
        const p = phases.find(ph => ph.id === hovered)
        if (!p) return null
        const duration = p.time && p.next ? dur(p.time, p.next) : null
        return (
          <div
            className="absolute pointer-events-none bg-black/90 border border-border rounded-md px-3 py-2 text-xs font-mono shadow-lg"
            style={{ bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8, whiteSpace: 'nowrap' }}
          >
            <p className="text-green-primary font-bold">{p.desc}</p>
            {p.time && <p className="text-foreground/70 mt-0.5">{fmt(p.time)}</p>}
            {duration && <p className="text-foreground/40 mt-0.5">→ {duration}</p>}
          </div>
        )
      })()}
    </div>
  )
}
