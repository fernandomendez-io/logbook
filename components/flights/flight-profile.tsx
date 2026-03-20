'use client'

import { useState } from 'react'
import type { TrackPoint } from '@/lib/api/flightaware'

interface FlightProfileProps {
  outUtc:          string | null
  offUtc:          string | null
  onUtc:           string | null
  inUtc:           string | null
  descentStartUtc: string | null
  cruiseAltFt:     number | null
  cruiseGspeedKts: number | null
  departureRunway: string | null
  landingRunway:   string | null
  trackPoints?:    TrackPoint[]
}

// SVG constants
const W = 800
const H = 220
const PAD_X = 52
const GROUND_Y = 178
const CRUISE_Y = 36
const SPEED_Y_TOP = 36    // speed scale top (same as altitude top)
const SPEED_Y_BOT = 178   // speed scale bottom

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

// Catmull-Rom → cubic bezier
function catmullToCubic(
  p0: [number, number], p1: [number, number],
  p2: [number, number], p3: [number, number]
): [[number, number], [number, number]] {
  return [
    [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
    [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
  ]
}

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

function interpY(ms: number, pts: { ms: number; y: number }[]): number {
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
  departureRunway, landingRunway,
  trackPoints = [],
}: FlightProfileProps) {
  const [hovered, setHovered] = useState<{ x: number; ms: number } | null>(null)

  const startMs = toMs(outUtc || offUtc)
  const endMs   = toMs(inUtc  || onUtc)
  if (!startMs || !endMs || endMs <= startMs) return null

  const span = endMs - startMs

  function tx(iso: string | null | undefined): number {
    if (!iso) return PAD_X
    return PAD_X + ((toMs(iso) - startMs) / span) * (W - PAD_X * 2)
  }

  const xOut  = PAD_X
  const xOff  = tx(offUtc)
  const xOn   = tx(onUtc)
  const xIn   = W - PAD_X
  const xDesc = descentStartUtc ? tx(descentStartUtc) : W - PAD_X - (W - PAD_X * 2) * 0.22
  const xCruiseMid = (xOff + xDesc) / 2

  // ── Altitude data from track ──────────────────────────────────────────────
  const altPoints = trackPoints
    .filter(p => p.alt != null && p.timestamp && p.alt > 0)
    .map(p => ({ ms: toMs(p.timestamp), alt: p.alt }))
    .filter(p => p.ms >= startMs && p.ms <= endMs)
    .sort((a, b) => a.ms - b.ms)

  const useRealAlt = altPoints.length >= 3
  const maxAlt = useRealAlt ? Math.max(...altPoints.map(p => p.alt)) : 1
  const altToY = (alt: number) => GROUND_Y - (alt / maxAlt) * (GROUND_Y - CRUISE_Y)

  const step = useRealAlt ? Math.max(1, Math.floor(altPoints.length / 120)) : 1
  const svgAltPts: [number, number][] = useRealAlt
    ? altPoints
        .filter((_, i) => i % step === 0 || i === altPoints.length - 1)
        .map(p => [PAD_X + ((p.ms - startMs) / span) * (W - PAD_X * 2), altToY(p.alt)])
    : []

  const altYLookup = altPoints.map(p => ({ ms: p.ms, y: altToY(p.alt) }))
  const phaseY = (iso: string | null | undefined) =>
    useRealAlt && iso ? interpY(toMs(iso), altYLookup) : GROUND_Y

  // ── Speed data from track ─────────────────────────────────────────────────
  const speedPoints = trackPoints
    .filter(p => p.gspeed > 0 && p.timestamp)
    .map(p => ({ ms: toMs(p.timestamp), spd: p.gspeed }))
    .filter(p => p.ms >= startMs && p.ms <= endMs)
    .sort((a, b) => a.ms - b.ms)

  const useSpeed = speedPoints.length >= 3
  const maxSpd = useSpeed ? Math.max(...speedPoints.map(p => p.spd), 1) : 1
  const spdToY = (spd: number) => SPEED_Y_BOT - (spd / maxSpd) * (SPEED_Y_BOT - SPEED_Y_TOP)

  const spdStep = useSpeed ? Math.max(1, Math.floor(speedPoints.length / 80)) : 1
  const svgSpdPts: [number, number][] = useSpeed
    ? speedPoints
        .filter((_, i) => i % spdStep === 0 || i === speedPoints.length - 1)
        .map(p => [PAD_X + ((p.ms - startMs) / span) * (W - PAD_X * 2), spdToY(p.spd)])
    : []

  // ── Paths ─────────────────────────────────────────────────────────────────
  let altPath: string
  let altFill: string

  if (useRealAlt && svgAltPts.length >= 2) {
    const allPts: [number, number][] = [[xOut, GROUND_Y], ...svgAltPts, [xIn, GROUND_Y]]
    altPath = catmullPath(allPts)
    altFill = altPath + ` L ${xIn} ${H - 8} L ${xOut} ${H - 8} Z`
  } else {
    const bezier = [
      `M ${xOut} ${GROUND_Y}`,
      `C ${xOut + 20} ${GROUND_Y}, ${xOff - 20} ${CRUISE_Y + 30}, ${xOff} ${CRUISE_Y + 10}`,
      `C ${xOff + 40} ${CRUISE_Y}, ${xDesc - 40} ${CRUISE_Y}, ${xDesc} ${CRUISE_Y + 10}`,
      `C ${xDesc + 20} ${CRUISE_Y + 30}, ${xOn - 20} ${GROUND_Y}, ${xOn} ${GROUND_Y}`,
      `L ${xIn} ${GROUND_Y}`,
    ].join(' ')
    altPath = bezier
    altFill = bezier + ` L ${xIn} ${H - 8} L ${xOut} ${H - 8} Z`
  }

  const spdPath = useSpeed && svgSpdPts.length >= 2 ? catmullPath(svgSpdPts) : ''

  // ── Phase dots ────────────────────────────────────────────────────────────
  const offY  = useRealAlt ? phaseY(offUtc)          : CRUISE_Y + 10
  const descY = useRealAlt ? phaseY(descentStartUtc) : CRUISE_Y + 10
  const onY   = useRealAlt ? phaseY(onUtc)           : GROUND_Y
  const cruiseY = useRealAlt ? (maxAlt > 0 ? altToY(maxAlt) : CRUISE_Y) : CRUISE_Y

  const phases = [
    { id: 'out',    x: xOut,       y: GROUND_Y, label: 'OUT',     time: outUtc,          next: offUtc,  desc: 'Gate departure' },
    { id: 'off',    x: xOff,       y: offY,     label: 'OFF',     time: offUtc,          next: onUtc,   desc: 'Wheels off' },
    { id: 'cruise', x: xCruiseMid, y: cruiseY,  label: 'Cruise',  time: null,            next: null,    desc: 'Cruise phase' },
    { id: 'desc',   x: xDesc,      y: descY,    label: 'TOD',     time: descentStartUtc, next: onUtc,   desc: 'Top of descent' },
    { id: 'on',     x: xOn,        y: onY,      label: 'ON',      time: onUtc,           next: inUtc,   desc: 'Wheels on' },
    { id: 'in',     x: xIn,        y: GROUND_Y, label: 'IN',      time: inUtc,           next: null,    desc: 'Gate arrival' },
  ]

  // ── Hover data interpolation ──────────────────────────────────────────────
  const spdYLookup = speedPoints.map(p => ({ ms: p.ms, y: spdToY(p.spd) }))

  function hoverAlt(ms: number): number | null {
    if (!useRealAlt) return null
    const pt = altPoints.reduce((best, p) => Math.abs(p.ms - ms) < Math.abs(best.ms - ms) ? p : best, altPoints[0])
    return pt ? pt.alt : null
  }

  function hoverSpd(ms: number): number | null {
    if (!useSpeed) return null
    const pt = speedPoints.reduce((best, p) => Math.abs(p.ms - ms) < Math.abs(best.ms - ms) ? p : best, speedPoints[0])
    return pt ? pt.spd : null
  }

  return (
    <div
      className="relative w-full select-none"
      onMouseLeave={() => setHovered(null)}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 'auto', display: 'block', cursor: 'crosshair' }}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
          const svgX = ((e.clientX - rect.left) / rect.width) * W
          if (svgX >= PAD_X && svgX <= W - PAD_X) {
            const ms = startMs + ((svgX - PAD_X) / (W - PAD_X * 2)) * span
            setHovered({ x: svgX, ms })
          } else {
            setHovered(null)
          }
        }}
      >
        <defs>
          <linearGradient id="profileGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#22c55e" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Ground line */}
        <line x1={PAD_X} y1={GROUND_Y} x2={W - PAD_X} y2={GROUND_Y}
              stroke="#374151" strokeWidth="1" />

        {/* TOD guide */}
        {descentStartUtc && (
          <line x1={xDesc} y1={CRUISE_Y + 5} x2={xDesc} y2={GROUND_Y}
                stroke="#22c55e" strokeWidth="0.5" strokeOpacity="0.18" strokeDasharray="2 4" />
        )}

        {/* Altitude fill + curve */}
        <path d={altFill} fill="url(#profileGrad)" />
        <path d={altPath} fill="none" stroke="#22c55e" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" />

        {/* Groundspeed overlay (dashed, lighter) */}
        {spdPath && (
          <path d={spdPath} fill="none" stroke="#60a5fa" strokeWidth="1.5"
                strokeDasharray="4 3" strokeLinecap="round" strokeLinejoin="round"
                opacity="0.55" />
        )}

        {/* Runway labels */}
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
            <rect x={xCruiseMid - 44} y={cruiseY - 24} width="88" height="17"
                  rx="4" fill="#0a1a0a" stroke="#22c55e" strokeWidth="0.5" strokeOpacity="0.45" />
            <text x={xCruiseMid} y={cruiseY - 12} textAnchor="middle"
                  fontSize="9.5" fill="#4ade80" fontFamily="monospace">
              {cruiseAltFt ? `FL${Math.round(cruiseAltFt / 100)}` : ''}
              {cruiseAltFt && cruiseGspeedKts ? ' · ' : ''}
              {cruiseGspeedKts ? `${cruiseGspeedKts}kt` : ''}
            </text>
          </g>
        )}

        {/* Speed scale label (right side) */}
        {useSpeed && (
          <>
            <text x={W - PAD_X + 4} y={SPEED_Y_TOP + 6} fontSize="8" fill="#60a5fa"
                  fontFamily="monospace" opacity="0.6">{maxSpd}kt</text>
            <text x={W - PAD_X + 4} y={SPEED_Y_BOT} fontSize="8" fill="#60a5fa"
                  fontFamily="monospace" opacity="0.4">0kt</text>
          </>
        )}

        {/* Phase dots */}
        {phases.map(p => (
          <g key={p.id} style={{ cursor: 'default' }}>
            <circle cx={p.x} cy={p.y} r={4}
                    fill="#166534" stroke="#22c55e" strokeWidth="1.5" />
            <text x={p.x} y={p.id === 'cruise' ? p.y - 8 : GROUND_Y + 28}
                  textAnchor="middle" fontSize="8.5" fill="#6b7280" fontFamily="monospace">
              {p.label}
            </text>
          </g>
        ))}

        {/* Hover crosshair */}
        {hovered && (
          <line x1={hovered.x} y1={CRUISE_Y} x2={hovered.x} y2={GROUND_Y}
                stroke="#ffffff" strokeWidth="0.75" strokeOpacity="0.2" strokeDasharray="3 3" />
        )}
      </svg>

      {/* Speed legend */}
      {useSpeed && (
        <div className="absolute bottom-6 left-14 flex items-center gap-3 pointer-events-none">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 bg-green-500 rounded" />
            <span className="text-[10px] text-foreground/40 font-mono">Altitude</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="20" height="4" className="overflow-visible">
              <line x1="0" y1="2" x2="20" y2="2" stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="4 3" />
            </svg>
            <span className="text-[10px] text-blue-400/60 font-mono">Groundspeed</span>
          </div>
        </div>
      )}

      {/* Hover tooltip */}
      {hovered && (() => {
        const alt = hoverAlt(hovered.ms)
        const spd = hoverSpd(hovered.ms)
        const time = fmt(new Date(hovered.ms).toISOString())
        if (!alt && !spd) return null
        const leftPct = ((hovered.x - PAD_X) / (W - PAD_X * 2)) * 100
        return (
          <div
            className="absolute pointer-events-none bg-black/95 border border-border/60 rounded-md px-3 py-2 text-xs font-mono shadow-lg"
            style={{
              bottom: '100%',
              left: `clamp(8px, calc(${leftPct}% - 50px), calc(100% - 120px))`,
              marginBottom: 6,
              whiteSpace: 'nowrap',
              minWidth: 100,
            }}
          >
            <p className="text-foreground/50 text-[10px] mb-1">{time}</p>
            {alt != null && (
              <p className="text-green-400">
                FL{Math.round(alt / 100)}
                <span className="text-foreground/40 text-[10px] ml-1">({alt.toLocaleString()}ft)</span>
              </p>
            )}
            {spd != null && (
              <p className="text-blue-400">{spd} kt GS</p>
            )}
          </div>
        )
      })()}

      {/* Static phase tooltip (when not hovering over the graph) */}
    </div>
  )
}
