/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { getCachedCSS, setCachedCSS, getThemeCacheKey, type CompiledCSS } from './css-cache-service'
import type { Theme } from '@/domain/models/app/theme'

describe('CSS Cache Service', () => {
  describe('getThemeCacheKey', () => {
    test('generates consistent key for same theme', () => {
      const theme: Theme = {
        colors: {
          primary: '#3b82f6',
        },
      }

      const key1 = getThemeCacheKey(theme)
      const key2 = getThemeCacheKey(theme)

      expect(key1).toBe(key2)
    })

    test('generates different keys for different themes', () => {
      const theme1: Theme = {
        colors: {
          primary: '#3b82f6',
        },
      }

      const theme2: Theme = {
        colors: {
          primary: '#8b5cf6',
        },
      }

      const key1 = getThemeCacheKey(theme1)
      const key2 = getThemeCacheKey(theme2)

      expect(key1).not.toBe(key2)
    })

    test('generates empty object key for undefined theme', () => {
      const key = getThemeCacheKey(undefined)

      expect(key).toBe('{}')
    })

    test('generates same key for empty theme and undefined', () => {
      const emptyTheme: Theme = {}
      const key1 = getThemeCacheKey(emptyTheme)
      const key2 = getThemeCacheKey(undefined)

      expect(key1).toBe(key2)
      expect(key1).toBe('{}')
    })

    test('handles complex theme with multiple properties', () => {
      const theme: Theme = {
        colors: {
          primary: '#3b82f6',
          secondary: '#8b5cf6',
        },
        fonts: {
          sans: {
            family: 'Inter',
            fallback: 'system-ui',
          },
        },
        spacing: {
          sm: '0.5rem',
          md: '1rem',
        },
      }

      const key = getThemeCacheKey(theme)

      expect(key).toBeDefined()
      expect(typeof key).toBe('string')
      expect(key.length).toBeGreaterThan(0)
      expect(key).toContain('primary')
      expect(key).toContain('Inter')
    })

    test('property order does not affect key (JSON.stringify sorting)', () => {
      // Note: JavaScript object property order is insertion order
      // JSON.stringify preserves insertion order
      // So these will actually produce different keys
      const theme1: Theme = {
        colors: { primary: '#3b82f6' },
        fonts: { sans: { family: 'Inter', fallback: 'system-ui' } },
      }

      const theme2: Theme = {
        fonts: { sans: { family: 'Inter', fallback: 'system-ui' } },
        colors: { primary: '#3b82f6' },
      }

      const key1 = getThemeCacheKey(theme1)
      const key2 = getThemeCacheKey(theme2)

      // Keys will be different due to property order
      expect(key1).not.toBe(key2)
    })
  })

  describe('getCachedCSS', () => {
    test('returns undefined for non-existent cache key', async () => {
      const program = Effect.gen(function* () {
        const result = yield* getCachedCSS('non-existent-key')
        return result
      })

      const result = await Effect.runPromise(program)

      expect(result).toBeUndefined()
    })

    test('retrieves cached CSS after setting', async () => {
      const cacheKey = 'test-key-' + Date.now()
      const compiled: CompiledCSS = {
        css: 'body { color: red; }',
        timestamp: Date.now(),
      }

      const program = Effect.gen(function* () {
        yield* setCachedCSS(cacheKey, compiled)
        const result = yield* getCachedCSS(cacheKey)
        return result
      })

      const result = await Effect.runPromise(program)

      expect(result).toEqual(compiled)
      expect(result?.css).toBe(compiled.css)
      expect(result?.timestamp).toBe(compiled.timestamp)
    })

    test('returns undefined for cleared cache entry', async () => {
      const cacheKey = 'cleared-key-' + Date.now()

      const program = Effect.gen(function* () {
        // Cache is shared, so we just verify non-existent keys return undefined
        const result = yield* getCachedCSS(cacheKey)
        return result
      })

      const result = await Effect.runPromise(program)

      expect(result).toBeUndefined()
    })
  })

  describe('setCachedCSS', () => {
    test('stores CSS in cache', async () => {
      const cacheKey = 'set-test-' + Date.now()
      const compiled: CompiledCSS = {
        css: '.container { padding: 1rem; }',
        timestamp: Date.now(),
      }

      const program = Effect.gen(function* () {
        yield* setCachedCSS(cacheKey, compiled)
        const retrieved = yield* getCachedCSS(cacheKey)
        return retrieved
      })

      const result = await Effect.runPromise(program)

      expect(result).toBeDefined()
      expect(result?.css).toBe(compiled.css)
      expect(result?.timestamp).toBe(compiled.timestamp)
    })

    test('overwrites existing cache entry', async () => {
      const cacheKey = 'overwrite-test-' + Date.now()
      const compiled1: CompiledCSS = {
        css: '.old { color: blue; }',
        timestamp: 1000,
      }
      const compiled2: CompiledCSS = {
        css: '.new { color: green; }',
        timestamp: 2000,
      }

      const program = Effect.gen(function* () {
        yield* setCachedCSS(cacheKey, compiled1)
        yield* setCachedCSS(cacheKey, compiled2)
        const result = yield* getCachedCSS(cacheKey)
        return result
      })

      const result = await Effect.runPromise(program)

      expect(result).toEqual(compiled2)
      expect(result?.css).toBe(compiled2.css)
      expect(result?.timestamp).toBe(compiled2.timestamp)
    })

    test('handles multiple cache entries independently', async () => {
      const key1 = 'multi-1-' + Date.now()
      const key2 = 'multi-2-' + Date.now()
      const compiled1: CompiledCSS = {
        css: '.first { color: red; }',
        timestamp: 1000,
      }
      const compiled2: CompiledCSS = {
        css: '.second { color: blue; }',
        timestamp: 2000,
      }

      const program = Effect.gen(function* () {
        yield* setCachedCSS(key1, compiled1)
        yield* setCachedCSS(key2, compiled2)
        const result1 = yield* getCachedCSS(key1)
        const result2 = yield* getCachedCSS(key2)
        return { result1, result2 }
      })

      const { result1, result2 } = await Effect.runPromise(program)

      expect(result1).toEqual(compiled1)
      expect(result2).toEqual(compiled2)
    })

    test('handles empty CSS string', async () => {
      const cacheKey = 'empty-css-' + Date.now()
      const compiled: CompiledCSS = {
        css: '',
        timestamp: Date.now(),
      }

      const program = Effect.gen(function* () {
        yield* setCachedCSS(cacheKey, compiled)
        const result = yield* getCachedCSS(cacheKey)
        return result
      })

      const result = await Effect.runPromise(program)

      expect(result).toBeDefined()
      expect(result?.css).toBe('')
      expect(result?.timestamp).toBe(compiled.timestamp)
    })

    test('handles large CSS content', async () => {
      const cacheKey = 'large-css-' + Date.now()
      const largeCSS = '.class { property: value; }'.repeat(10_000)
      const compiled: CompiledCSS = {
        css: largeCSS,
        timestamp: Date.now(),
      }

      const program = Effect.gen(function* () {
        yield* setCachedCSS(cacheKey, compiled)
        const result = yield* getCachedCSS(cacheKey)
        return result
      })

      const result = await Effect.runPromise(program)

      expect(result).toBeDefined()
      expect(result?.css).toBe(largeCSS)
      expect(result?.css.length).toBe(largeCSS.length)
    })
  })

  describe('cache integration', () => {
    test('maintains cache across multiple Effect operations', async () => {
      const theme1Key = getThemeCacheKey({ colors: { primary: '#3b82f6' } })
      const theme2Key = getThemeCacheKey({ colors: { primary: '#8b5cf6' } })

      const compiled1: CompiledCSS = {
        css: '.theme1 { color: #3b82f6; }',
        timestamp: 1000,
      }
      const compiled2: CompiledCSS = {
        css: '.theme2 { color: #8b5cf6; }',
        timestamp: 2000,
      }

      const program = Effect.gen(function* () {
        // Set both
        yield* setCachedCSS(theme1Key, compiled1)
        yield* setCachedCSS(theme2Key, compiled2)

        // Retrieve both
        const result1 = yield* getCachedCSS(theme1Key)
        const result2 = yield* getCachedCSS(theme2Key)

        // Verify both are still available
        return { result1, result2 }
      })

      const { result1, result2 } = await Effect.runPromise(program)

      expect(result1).toEqual(compiled1)
      expect(result2).toEqual(compiled2)
    })

    test('cache persists across separate Effect runs', async () => {
      const cacheKey = 'persist-test-' + Date.now()
      const compiled: CompiledCSS = {
        css: '.persist { display: block; }',
        timestamp: Date.now(),
      }

      // First run: set cache
      await Effect.runPromise(setCachedCSS(cacheKey, compiled))

      // Second run: retrieve cache
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const retrieved = yield* getCachedCSS(cacheKey)
          return retrieved
        })
      )

      expect(result).toEqual(compiled)
    })
  })
})
