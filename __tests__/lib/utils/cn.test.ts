import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils/cn'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('deduplicates conflicting Tailwind classes (keeps last)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('ignores falsy values', () => {
    expect(cn('foo', false && 'bar', undefined, null, 'baz')).toBe('foo baz')
  })

  it('handles conditional classes', () => {
    const active = true
    expect(cn('base', active && 'active')).toBe('base active')
  })

  it('handles empty input', () => {
    expect(cn()).toBe('')
  })

  it('merges conflicting text colors', () => {
    expect(cn('text-red-500', 'text-green-500')).toBe('text-green-500')
  })
})
