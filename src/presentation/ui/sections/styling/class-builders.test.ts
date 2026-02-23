/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { buildFlexClasses, buildGridClasses } from './class-builders'

describe('Class Builders', () => {
  describe('buildFlexClasses', () => {
    test('returns base flex class when no props provided', () => {
      const result = buildFlexClasses()
      expect(result).toBe('flex')
    })

    test('returns base flex class when empty props provided', () => {
      const result = buildFlexClasses({})
      expect(result).toBe('flex')
    })

    test('adds items-start class when align is start', () => {
      const result = buildFlexClasses({ align: 'start' })
      expect(result).toBe('flex items-start')
    })

    test('adds items-center class when align is center', () => {
      const result = buildFlexClasses({ align: 'center' })
      expect(result).toBe('flex items-center')
    })

    test('adds items-end class when align is end', () => {
      const result = buildFlexClasses({ align: 'end' })
      expect(result).toBe('flex items-end')
    })

    test('does not add alignment class for invalid align value', () => {
      const result = buildFlexClasses({ align: 'invalid' })
      expect(result).toBe('flex')
    })

    test('adds gap class when gap is a number', () => {
      const result = buildFlexClasses({ gap: 4 })
      expect(result).toBe('flex gap-4')
    })

    test('adds gap class for various numeric values', () => {
      expect(buildFlexClasses({ gap: 0 })).toBe('flex gap-0')
      expect(buildFlexClasses({ gap: 2 })).toBe('flex gap-2')
      expect(buildFlexClasses({ gap: 8 })).toBe('flex gap-8')
      expect(buildFlexClasses({ gap: 16 })).toBe('flex gap-16')
    })

    test('does not add gap class when gap is not a number', () => {
      expect(buildFlexClasses({ gap: '4' })).toBe('flex')
      expect(buildFlexClasses({ gap: 'large' })).toBe('flex')
      expect(buildFlexClasses({ gap: true })).toBe('flex')
    })

    test('combines alignment and gap classes', () => {
      const result = buildFlexClasses({ align: 'center', gap: 4 })
      expect(result).toBe('flex items-center gap-4')
    })

    test('handles all valid combinations', () => {
      expect(buildFlexClasses({ align: 'start', gap: 2 })).toBe('flex items-start gap-2')
      expect(buildFlexClasses({ align: 'center', gap: 4 })).toBe('flex items-center gap-4')
      expect(buildFlexClasses({ align: 'end', gap: 8 })).toBe('flex items-end gap-8')
    })

    test('ignores extra props', () => {
      const result = buildFlexClasses({
        align: 'center',
        gap: 4,
        someOtherProp: 'value',
        anotherProp: 123,
      })
      expect(result).toBe('flex items-center gap-4')
    })
  })

  describe('buildGridClasses', () => {
    test('returns base grid class with default columns when no props provided', () => {
      const result = buildGridClasses()
      expect(result).toBe('grid grid-cols-1')
    })

    test('returns base grid class with specified columns', () => {
      const result = buildGridClasses({ columns: 3 })
      expect(result).toBe('grid grid-cols-3')
    })

    test('returns base grid class when no responsive breakpoints provided', () => {
      const result = buildGridClasses({ columns: 2 })
      expect(result).toBe('grid grid-cols-2')
    })

    test('adds md responsive class when md breakpoint provided', () => {
      const result = buildGridClasses({ columns: 1, responsive: { md: 2 } })
      expect(result).toBe('grid grid-cols-1 md:grid-cols-2')
    })

    test('adds both md and lg responsive classes when provided', () => {
      const result = buildGridClasses({ columns: 1, responsive: { md: 2, lg: 3 } })
      expect(result).toBe('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3')
    })

    test('handles only lg breakpoint without md', () => {
      const result = buildGridClasses({ columns: 2, responsive: { lg: 4 } })
      expect(result).toBe('grid grid-cols-2 lg:grid-cols-4')
    })
  })
})
