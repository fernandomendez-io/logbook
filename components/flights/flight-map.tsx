'use client'

import dynamic from 'next/dynamic'
import type { TrackPoint } from '@/lib/api/flightaware'

const FlightMapInner = dynamic(() => import('./flight-map-inner'), { ssr: false })

interface FlightMapProps {
  trackPoints: TrackPoint[]
  originIcao: string
  destIcao: string
}

export function FlightMap(props: FlightMapProps) {
  return <FlightMapInner {...props} />
}
