import { describe, it, expect } from 'vitest'
import { classifyApproach } from '@/lib/aviation/approach-classifier'

describe('classifyApproach', () => {
  it('returns visual with high confidence for VMC (ceiling 5000ft / vis 10sm)', () => {
    const result = classifyApproach(5000, 10)
    expect(result.type).toBe('visual')
    expect(result.confidence).toBe('high')
  })

  it('returns visual for clear sky (null ceiling / good vis)', () => {
    const result = classifyApproach(null, 10)
    expect(result.type).toBe('visual')
    expect(result.confidence).toBe('high')
  })

  it('returns visual with medium confidence for marginal VMC (ceiling 2000 / vis 4)', () => {
    const result = classifyApproach(2000, 4)
    expect(result.type).toBe('visual')
    expect(result.confidence).toBe('medium')
  })

  it('returns RNAV for IMC conditions (ceiling 600 / vis 1.5)', () => {
    const result = classifyApproach(600, 1.5)
    expect(result.type).toBe('RNAV')
  })

  it('returns ILS for CAT I conditions (ceiling 300 / vis 0.75)', () => {
    const result = classifyApproach(300, 0.75)
    expect(result.type).toBe('ILS')
    expect(result.confidence).toBe('high')
    expect(result.reason).toContain('CAT I')
  })

  it('returns ILS for low visibility (ceiling 100 / vis 0.25)', () => {
    const result = classifyApproach(100, 0.25)
    expect(result.type).toBe('ILS')
    expect(result.confidence).toBe('high')
    expect(result.reason).toContain('CAT II/III')
  })

  it('returns ILS when ceiling is at exactly 200ft threshold', () => {
    const result = classifyApproach(200, 0.5)
    expect(result.type).toBe('ILS')
  })

  it('options array always includes the primary type', () => {
    const vmc = classifyApproach(5000, 10)
    expect(vmc.options).toContain('visual')

    const imc = classifyApproach(300, 0.75)
    expect(imc.options).toContain('ILS')
  })
})
