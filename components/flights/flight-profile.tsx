'use client'

import { useState } from 'react'

export interface AirspaceTransition {
  timestamp: string
  exited:    string | null
  entered:   string | null
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
}

// SVG constants
const W = 800
const H = 200
const PAD_X = 48
const GROUND_Y = 172
const CRUISE_Y = 38
const CLIMB_X_FRAC  = 0.18   // OFF is ~18% across timeline
const CRUISE_X_FRAC = 0.50   // cruise midpoint
const DESCENT_X_FRAC = 0.78  // descent starts ~78%

function toMs(iso: string | null): number {
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

export function FlightProfile({
  outUtc, offUtc, onUtc, inUtc,
  descentStartUtc,
  cruiseAltFt, cruiseGspeedKts,
  airspaceTransitions,
  departureRunway, landingRunway,
}: FlightProfileProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  // Timeline boundaries — use OUT/IN with fallback to OFF/ON
  const startMs = toMs(outUtc || offUtc)
  const endMs   = toMs(inUtc  || onUtc)
  if (!startMs || !endMs || endMs <= startMs) return null

  const span = endMs - startMs

  // Convert timestamp to SVG x
  function tx(iso: string | null): number {
    if (!iso) return PAD_X
    const ms = toMs(iso)
    return PAD_X + ((ms - startMs) / span) * (W - PAD_X * 2)
  }

  const xOut  = PAD_X
  const xOff  = tx(offUtc)
  const xDesc = descentStartUtc ? tx(descentStartUtc) : W - PAD_X - (W - PAD_X * 2) * 0.22
  const xOn   = tx(onUtc)
  const xIn   = W - PAD_X

  // Hill path: smooth cubic bezier
  const path = [
    `M ${xOut} ${GROUND_Y}`,
    // climb: steep ramp from OUT → OFF, continuing to cruise level
    `C ${xOut + 20} ${GROUND_Y}, ${xOff - 20} ${CRUISE_Y + 30}, ${xOff} ${CRUISE_Y + 10}`,
    // cruise plateau: OUT of climb → into descent
    `C ${xOff + 40} ${CRUISE_Y}, ${xDesc - 40} ${CRUISE_Y}, ${xDesc} ${CRUISE_Y + 10}`,
    // descent: ramp down to landing
    `C ${xDesc + 20} ${CRUISE_Y + 30}, ${xOn - 20} ${GROUND_Y}, ${xOn} ${GROUND_Y}`,
    // taxi in
    `L ${xIn} ${GROUND_Y}`,
  ].join(' ')

  // Gradient fill path (closed)
  const fillPath = path + ` L ${xIn} ${H - 10} L ${xOut} ${H - 10} Z`

  // Key phase dots
  const phases = [
    { id: 'out',    x: xOut,  y: GROUND_Y,      label: 'OUT',     time: outUtc,  next: offUtc,  desc: 'Gate departure' },
    { id: 'off',    x: xOff,  y: CRUISE_Y + 10, label: 'OFF',     time: offUtc,  next: onUtc,   desc: 'Wheels off' },
    { id: 'cruise', x: tx(descentStartUtc ? undefined : null) || (xOff + xDesc) / 2,
                              y: CRUISE_Y,       label: 'Cruise',  time: null,    next: null,    desc: 'Cruise phase' },
    { id: 'desc',   x: xDesc, y: CRUISE_Y + 10, label: 'Descent', time: descentStartUtc, next: onUtc, desc: 'Top of descent' },
    { id: 'on',     x: xOn,   y: GROUND_Y,      label: 'ON',      time: onUtc,   next: inUtc,   desc: 'Wheels on' },
    { id: 'in',     x: xIn,   y: GROUND_Y,      label: 'IN',      time: inUtc,   next: null,    desc: 'Gate arrival' },
  ]
  // Cruise midpoint x for badges
  const xCruiseMid = (xOff + xDesc) / 2

  // Airspace transitions — map to x positions, show entered center name
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

        {/* Hill curve */}
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
            <rect x={xCruiseMid - 42} y={CRUISE_Y - 22} width="84" height="16"
                  rx="4" fill="#0f1a0f" stroke="#22c55e" strokeWidth="0.5" strokeOpacity="0.4" />
            <text x={xCruiseMid} y={CRUISE_Y - 11} textAnchor="middle"
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
            {/* Larger invisible hit area */}
            <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
            {/* Visible dot */}
            <circle cx={p.x} cy={p.y} r={hovered === p.id ? 5 : 3.5}
                    fill={hovered === p.id ? '#22c55e' : '#166534'}
                    stroke="#22c55e" strokeWidth="1.5"
                    style={{ transition: 'r 0.1s' }} />
            {/* Phase label below (above for cruise) */}
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

      {/* Tooltip — rendered in HTML for better styling */}
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
