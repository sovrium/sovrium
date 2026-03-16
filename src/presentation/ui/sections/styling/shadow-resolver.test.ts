/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { getComponentShadow } from './shadow-resolver'
import type { Component } from '@/domain/models/app/page/sections'
import type { Theme } from '@/domain/models/app/theme'

describe('Shadow Resolver', () => {
  describe('getComponentShadow', () => {
    test('returns undefined when theme is undefined', () => {
      const result = getComponentShadow('card', undefined)
      expect(result).toBeUndefined()
    })

    test('returns undefined when theme has no shadows', () => {
      const theme: Theme = {}
      const result = getComponentShadow('card', theme)
      expect(result).toBeUndefined()
    })

    test('returns undefined for component type with no shadow mapping', () => {
      const theme: Theme = {
        shadows: {
          sm: '0 1px 2px rgba(0,0,0,0.05)',
          md: '0 4px 6px rgba(0,0,0,0.1)',
        },
      }
      const result = getComponentShadow('section' as Component['type'], theme)
      expect(result).toBeUndefined()
    })

    describe('card component', () => {
      test('uses custom shadow when available', () => {
        const theme: Theme = {
          shadows: {
            sm: '0 1px 2px rgba(0,0,0,0.05)',
            md: '0 4px 6px rgba(0,0,0,0.1)',
            brand: '0 8px 16px rgba(59,130,246,0.3)',
          },
        }
        const result = getComponentShadow('card', theme)
        expect(result).toEqual({ boxShadow: 'var(--shadow-brand)' })
      })

      test('falls back to md shadow when no custom shadow', () => {
        const theme: Theme = {
          shadows: {
            sm: '0 1px 2px rgba(0,0,0,0.05)',
            md: '0 4px 6px rgba(0,0,0,0.1)',
            lg: '0 10px 15px rgba(0,0,0,0.1)',
          },
        }
        const result = getComponentShadow('card', theme)
        expect(result).toEqual({ boxShadow: 'var(--shadow-md)' })
      })

      test('returns undefined when no custom or md shadow', () => {
        const theme: Theme = {
          shadows: {
            sm: '0 1px 2px rgba(0,0,0,0.05)',
            lg: '0 10px 15px rgba(0,0,0,0.1)',
          },
        }
        const result = getComponentShadow('card', theme)
        expect(result).toBeUndefined()
      })
    })

    describe('button component', () => {
      test('uses brand shadow when available', () => {
        const theme: Theme = {
          shadows: {
            sm: '0 1px 2px rgba(0,0,0,0.05)',
            brand: '0 8px 16px rgba(59,130,246,0.3)',
            md: '0 4px 6px rgba(0,0,0,0.1)',
          },
        }
        const result = getComponentShadow('button', theme)
        expect(result).toEqual({ boxShadow: 'var(--shadow-brand)' })
      })

      test('falls back to md shadow when brand not available', () => {
        const theme: Theme = {
          shadows: {
            sm: '0 1px 2px rgba(0,0,0,0.05)',
            md: '0 4px 6px rgba(0,0,0,0.1)',
          },
        }
        const result = getComponentShadow('button', theme)
        expect(result).toEqual({ boxShadow: 'var(--shadow-md)' })
      })

      test('returns undefined when neither brand nor md available', () => {
        const theme: Theme = {
          shadows: {
            sm: '0 1px 2px rgba(0,0,0,0.05)',
          },
        }
        const result = getComponentShadow('button', theme)
        expect(result).toBeUndefined()
      })
    })

    describe('list-item component', () => {
      test('uses sm shadow', () => {
        const theme: Theme = {
          shadows: {
            sm: '0 1px 2px rgba(0,0,0,0.05)',
            md: '0 4px 6px rgba(0,0,0,0.1)',
          },
        }
        const result = getComponentShadow('list-item', theme)
        expect(result).toEqual({ boxShadow: 'var(--shadow-sm)' })
      })

      test('returns undefined when sm not available', () => {
        const theme: Theme = {
          shadows: {
            md: '0 4px 6px rgba(0,0,0,0.1)',
          },
        }
        const result = getComponentShadow('list-item', theme)
        expect(result).toBeUndefined()
      })
    })

    describe('dropdown component', () => {
      test('uses lg shadow', () => {
        const theme: Theme = {
          shadows: {
            sm: '0 1px 2px rgba(0,0,0,0.05)',
            lg: '0 10px 15px rgba(0,0,0,0.1)',
          },
        }
        const result = getComponentShadow('dropdown', theme)
        expect(result).toEqual({ boxShadow: 'var(--shadow-lg)' })
      })
    })

    describe('modal component', () => {
      test('uses xl shadow', () => {
        const theme: Theme = {
          shadows: {
            xl: '0 20px 25px rgba(0,0,0,0.15)',
          },
        }
        const result = getComponentShadow('modal', theme)
        expect(result).toEqual({ boxShadow: 'var(--shadow-xl)' })
      })
    })

    describe('input component', () => {
      test('uses inner shadow', () => {
        const theme: Theme = {
          shadows: {
            inner: 'inset 0 2px 4px rgba(0,0,0,0.06)',
          },
        }
        const result = getComponentShadow('input', theme)
        expect(result).toEqual({ boxShadow: 'var(--shadow-inner)' })
      })
    })
  })
})
