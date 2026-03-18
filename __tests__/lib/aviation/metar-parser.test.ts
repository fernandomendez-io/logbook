import { describe, it, expect } from 'vitest'
import { parseMetar } from '@/lib/aviation/metar-parser'

describe('parseMetar', () => {
  it('parses station and wind from a standard METAR', () => {
    const result = parseMetar('KJFK 151251Z 27012KT 10SM BKN180 OVC250 22/14 A2989')
    expect(result.station).toBe('KJFK')
    expect(result.windDir).toBe(270)
    expect(result.windSpeedKt).toBe(12)
    expect(result.gustKt).toBeNull()
    expect(result.visibilitySm).toBe(10)
  })

  it('identifies ceiling as lowest BKN or OVC layer', () => {
    const result = parseMetar('KJFK 151251Z 27012KT 5SM FEW015 BKN080 OVC120 18/12 A2992')
    expect(result.ceilingFt).toBe(8000)  // BKN080 = 8000ft, lowest significant layer
  })

  it('returns null ceiling for CLR sky', () => {
    const result = parseMetar('KORD 151251Z 36010KT 10SM CLR 20/10 A3002')
    expect(result.ceilingFt).toBeNull()
    expect(result.flightCategory).toBe('VFR')
  })

  it('parses gusting winds', () => {
    const result = parseMetar('KORD 151251Z 27020G35KT 7SM BKN045 18/08 A2998')
    expect(result.windSpeedKt).toBe(20)
    expect(result.gustKt).toBe(35)
  })

  it('parses fractional visibility', () => {
    const result = parseMetar('KJFK 151251Z 00000KT 1/4SM FG OVC002 14/13 A2988')
    expect(result.visibilitySm).toBe(0.25)
    expect(result.ceilingFt).toBe(200)
  })

  it('classifies LIFR conditions correctly', () => {
    const result = parseMetar('KJFK 151251Z 00000KT 1/4SM FG OVC002 14/13 A2988')
    expect(result.flightCategory).toBe('LIFR')
  })

  it('classifies IFR conditions correctly', () => {
    const result = parseMetar('KORD 151251Z 27010KT 2SM BR OVC009 15/12 A2995')
    expect(result.flightCategory).toBe('IFR')
  })

  it('classifies MVFR conditions correctly', () => {
    const result = parseMetar('KORD 151251Z 27010KT 4SM BKN025 18/10 A2998')
    expect(result.flightCategory).toBe('MVFR')
  })

  it('classifies VFR conditions correctly', () => {
    const result = parseMetar('KORD 151251Z 27010KT 10SM BKN060 22/12 A3001')
    expect(result.flightCategory).toBe('VFR')
  })

  it('parses temperature and dewpoint', () => {
    const result = parseMetar('KJFK 151251Z 27012KT 10SM BKN180 22/14 A2989')
    expect(result.tempC).toBe(22)
    expect(result.dewpointC).toBe(14)
  })

  it('parses negative (M-prefixed) temperatures', () => {
    const result = parseMetar('KORD 151251Z 36015KT 10SM OVC040 M05/M10 A3010')
    expect(result.tempC).toBe(-5)
    expect(result.dewpointC).toBe(-10)
  })

  it('parses altimeter setting', () => {
    const result = parseMetar('KJFK 151251Z 27012KT 10SM CLR 22/14 A2992')
    expect(result.altimeterInHg).toBeCloseTo(29.92, 2)
  })

  it('handles METAR with METAR prefix keyword', () => {
    const result = parseMetar('METAR KJFK 151251Z 27012KT 10SM CLR 22/14 A2992')
    expect(result.station).toBe('KJFK')
  })
})
