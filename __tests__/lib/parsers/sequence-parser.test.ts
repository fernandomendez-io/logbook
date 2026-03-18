import { describe, it, expect } from 'vitest'
import { parseSequence } from '@/lib/parsers/sequence-parser'

const SAMPLE_SEQUENCE = `SEQ 1234 BASE CLT SEL 075 DOM E75
CAPT SMITH JOHN EMP NBR 12345
F/O JONES MIKE EMP NBR 67890
SKD 15 54 3779 CLT 0600 DFW 0745 1.45 1.45
ACT 15 54 3779 CLT 0612 DFW 0802 1.50 1.50
SKD 15 54 3422 DFW 0915 ORD 1130 2.15 2.15
ACT 15 54 3422 DFW 0920 ORD 1135 2.15 2.15
D/P GTR 4.00
SKD ONDUTY 6.00
ACT ONDUTY 5.90
FDPT 0.00 START 0500 END 1200
SKD 16 54 3891 ORD 0800 CLT 1100 3.00 3.00
ACT 16 54 3891 ORD 0805 CLT 1108 3.03 3.03
D/P GTR 3.00
SKD ONDUTY 4.00
ACT ONDUTY 4.10
FDPT GTR 0.00 START 0700 END 1200
SEQ GTR 7.00 TAFB 26.00`

describe('parseSequence', () => {
  it('parses sequence header fields', () => {
    const result = parseSequence(SAMPLE_SEQUENCE, '2024-01')
    expect(result.sequenceNumber).toBe('1234')
    expect(result.domicile).toBe('CLT')
    expect(result.equipmentType).toBe('E75')
  })

  it('parses crew names and employee numbers', () => {
    const result = parseSequence(SAMPLE_SEQUENCE, '2024-01')
    expect(result.captainName).toBe('SMITH JOHN')
    expect(result.captainEmpNum).toBe('12345')
    expect(result.foName).toBe('JONES MIKE')
    expect(result.foEmpNum).toBe('67890')
  })

  it('parses duty periods correctly', () => {
    const result = parseSequence(SAMPLE_SEQUENCE, '2024-01')
    expect(result.dutyPeriods).toHaveLength(2)
  })

  it('parses flights in each duty period', () => {
    const result = parseSequence(SAMPLE_SEQUENCE, '2024-01')
    expect(result.dutyPeriods[0].flights).toHaveLength(2)
    expect(result.dutyPeriods[1].flights).toHaveLength(1)
  })

  it('parses flight origins and destinations', () => {
    const result = parseSequence(SAMPLE_SEQUENCE, '2024-01')
    const [f1, f2] = result.dutyPeriods[0].flights
    expect(f1.originIcao).toBe('CLT')
    expect(f1.destinationIcao).toBe('DFW')
    expect(f2.originIcao).toBe('DFW')
    expect(f2.destinationIcao).toBe('ORD')
  })

  it('parses flight numbers', () => {
    const result = parseSequence(SAMPLE_SEQUENCE, '2024-01')
    expect(result.dutyPeriods[0].flights[0].flightNumber).toBe('3779')
  })

  it('parses actual out/in times from ACT rows', () => {
    const result = parseSequence(SAMPLE_SEQUENCE, '2024-01')
    const f1 = result.dutyPeriods[0].flights[0]
    expect(f1.actualOut).toBe('0612')
    expect(f1.actualIn).toBe('0802')
  })

  it('marks non-deadhead flights as not deadhead', () => {
    const result = parseSequence(SAMPLE_SEQUENCE, '2024-01')
    expect(result.dutyPeriods[0].flights[0].isDeadhead).toBe(false)
  })

  it('collects all flights in allFlights', () => {
    const result = parseSequence(SAMPLE_SEQUENCE, '2024-01')
    expect(result.allFlights).toHaveLength(3)
  })

  it('parses TAFB and credit hours', () => {
    const result = parseSequence(SAMPLE_SEQUENCE, '2024-01')
    expect(result.tafbHrs).toBeCloseTo(26, 1)
  })

  it('identifies deadhead flights with EQ=99', () => {
    const dhSequence = `SEQ 9999 BASE CLT SEL 001 DOM E75
SKD 20 99 3500 CLT 1000 ORD 1200 2.00 2.00
ACT 20 99 3500 CLT 1005 ORD 1210 2.05 2.05
D/P GTR 2.00
SKD ONDUTY 3.00
ACT ONDUTY 3.00
FDPT GTR 0.00 START 0900 END 1300
SEQ GTR 2.00 TAFB 4.00`
    const result = parseSequence(dhSequence, '2024-01')
    expect(result.allFlights[0].isDeadhead).toBe(true)
  })

  it('returns a warning when no sequence header found', () => {
    const result = parseSequence('garbage input', '2024-01')
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.sequenceNumber).toBe('')
  })
})
