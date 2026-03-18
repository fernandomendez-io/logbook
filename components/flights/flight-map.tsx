'use client'

import dynamic from 'next/dynamic'

const FlightMapInner = dynamic(() => import('./flight-map-inner'), { ssr: false })

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

export function FlightMap(props: FlightMapProps) {
  return <FlightMapInner {...props} />
}
