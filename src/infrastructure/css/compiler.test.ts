/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { compileCSS } from './compiler'
import type { App } from '@/domain/models/app'

describe('CSS Compiler', () => {
  describe('compileCSS', () => {
    test('compiles CSS without theme', async () => {
      const program = Effect.gen(function* () {
        const result = yield* compileCSS()
        return result
      })

      const result = await Effect.runPromise(program)

      expect(result).toBeDefined()
      expect(result.css).toBeDefined()
      expect(typeof result.css).toBe('string')
      expect(result.css.length).toBeGreaterThan(0)
      expect(result.timestamp).toBeGreaterThan(0)
    })

    test('compiled CSS includes Tailwind base styles', async () => {
      const program = Effect.gen(function* () {
        const result = yield* compileCSS()
        return result
      })

      const result = await Effect.runPromise(program)

      // Tailwind base styles should be present
      // v4.1.17 output format varies (minified: `*,:before,:after` or formatted: `*, ::before, ::after`)
      expect(
        result.css.includes('*,:before,:after') || result.css.includes('*, ::before, ::after')
      ).toBe(true)
      expect(result.css).toContain('box-sizing')
    })

    test('compiles CSS with theme colors', async () => {
      const app: App = {
        name: 'Test App',
        description: 'Test',
        languages: {
          default: 'en',
          supported: [{ code: 'en', locale: 'en-US', label: 'English' }] as const,
        },
        pages: [],
        theme: {
          colors: {
            primary: '#3b82f6',
            secondary: '#8b5cf6',
            accent: '#10b981',
          },
        },
      }

      const program = Effect.gen(function* () {
        const result = yield* compileCSS(app)
        return result
      })

      const result = await Effect.runPromise(program)

      expect(result.css).toContain('--color-primary')
      expect(result.css).toContain('#3b82f6')
      expect(result.css).toContain('--color-secondary')
      expect(result.css).toContain('#8b5cf6')
      expect(result.css).toContain('--color-accent')
      expect(result.css).toContain('#10b981')
    })

    test('compiles CSS with theme fonts', async () => {
      const app: App = {
        name: 'Test App',
        description: 'Test',
        languages: {
          default: 'en',
          supported: [{ code: 'en', locale: 'en-US', label: 'English' }] as const,
        },
        pages: [],
        theme: {
          fonts: {
            sans: {
              family: 'Inter',
              fallback: 'system-ui, sans-serif',
            },
            mono: {
              family: 'Fira Code',
              fallback: 'monospace',
            },
          },
        },
      }

      const program = Effect.gen(function* () {
        const result = yield* compileCSS(app)
        return result
      })

      const result = await Effect.runPromise(program)

      expect(result.css).toContain('--font-sans')
      expect(result.css).toContain('Inter')
      expect(result.css).toContain('--font-mono')
      expect(result.css).toContain('Fira Code')
    })

    test('compiles CSS with theme spacing', async () => {
      const app: App = {
        name: 'Test App',
        description: 'Test',
        languages: {
          default: 'en',
          supported: [{ code: 'en', locale: 'en-US', label: 'English' }] as const,
        },
        pages: [],
        theme: {
          spacing: {
            xs: '0.25rem',
            sm: '0.5rem',
            md: '1rem',
            lg: '2rem',
            xl: '4rem',
          },
        },
      }

      const program = Effect.gen(function* () {
        const result = yield* compileCSS(app)
        return result
      })

      const result = await Effect.runPromise(program)

      expect(result.css).toContain('--spacing-xs')
      expect(result.css).toContain('0.25rem')
      expect(result.css).toContain('--spacing-md')
      expect(result.css).toContain('1rem')
    })

    test('compiles CSS with theme border radius', async () => {
      const app: App = {
        name: 'Test App',
        description: 'Test',
        languages: {
          default: 'en',
          supported: [{ code: 'en', locale: 'en-US', label: 'English' }] as const,
        },
        pages: [],
        theme: {
          borderRadius: {
            none: '0',
            sm: '0.125rem',
            md: '0.375rem',
            lg: '0.5rem',
          },
        },
      }

      const program = Effect.gen(function* () {
        const result = yield* compileCSS(app)
        return result
      })

      const result = await Effect.runPromise(program)

      expect(result.css).toContain('--radius-none')
      expect(result.css).toContain('--radius-sm')
      expect(result.css).toContain('--radius-md')
      expect(result.css).toContain('0.375rem')
    })

    test('compiles CSS with theme shadows', async () => {
      const app: App = {
        name: 'Test App',
        description: 'Test',
        languages: {
          default: 'en',
          supported: [{ code: 'en', locale: 'en-US', label: 'English' }] as const,
        },
        pages: [],
        theme: {
          shadows: {
            sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
          },
        },
      }

      const program = Effect.gen(function* () {
        const result = yield* compileCSS(app)
        return result
      })

      const result = await Effect.runPromise(program)

      expect(result.css).toContain('--shadow-sm')
      expect(result.css).toContain('--shadow-md')
      expect(result.css).toContain('--shadow-lg')
    })

    test('compiles CSS with theme breakpoints', async () => {
      const app: App = {
        name: 'Test App',
        description: 'Test',
        languages: {
          default: 'en',
          supported: [{ code: 'en', locale: 'en-US', label: 'English' }] as const,
        },
        pages: [],
        theme: {
          breakpoints: {
            sm: '640px',
            md: '768px',
            lg: '1024px',
            xl: '1280px',
          },
        },
      }

      const program = Effect.gen(function* () {
        const result = yield* compileCSS(app)
        return result
      })

      const result = await Effect.runPromise(program)

      expect(result.css).toContain('--breakpoint-sm')
      expect(result.css).toContain('640px')
      expect(result.css).toContain('--breakpoint-md')
      expect(result.css).toContain('768px')
    })

    test('compiles CSS with theme animations', async () => {
      const app: App = {
        name: 'Test App',
        description: 'Test',
        languages: {
          default: 'en',
          supported: [{ code: 'en', locale: 'en-US', label: 'English' }] as const,
        },
        pages: [],
        theme: {
          animations: {
            'fade-in': {
              keyframes: {
                '0%': { opacity: '0' },
                '100%': { opacity: '1' },
              },
              duration: '300ms',
              easing: 'ease-in',
            },
          },
        },
      }

      const program = Effect.gen(function* () {
        const result = yield* compileCSS(app)
        return result
      })

      const result = await Effect.runPromise(program)

      expect(result.css).toContain('fade-in')
      expect(result.css).toContain('opacity')
    })

    test('caches compiled CSS for same theme', async () => {
      const app: App = {
        name: 'Test App',
        description: 'Test',
        languages: {
          default: 'en',
          supported: [{ code: 'en', locale: 'en-US', label: 'English' }] as const,
        },
        pages: [],
        theme: {
          colors: {
            primary: '#3b82f6',
          },
        },
      }

      const program = Effect.gen(function* () {
        const result1 = yield* compileCSS(app)
        const result2 = yield* compileCSS(app)
        return { result1, result2 }
      })

      const { result1, result2 } = await Effect.runPromise(program)

      // Same app config should return cached result with same timestamp
      expect(result1.timestamp).toBe(result2.timestamp)
      expect(result1.css).toBe(result2.css)
    })

    test('compiles different CSS for different themes', async () => {
      const app1: App = {
        name: 'Test App 1',
        description: 'Test',
        languages: {
          default: 'en',
          supported: [{ code: 'en', locale: 'en-US', label: 'English' }] as const,
        },
        pages: [],
        theme: {
          colors: {
            primary: '#3b82f6',
          },
        },
      }

      const app2: App = {
        name: 'Test App 2',
        description: 'Test',
        languages: {
          default: 'en',
          supported: [{ code: 'en', locale: 'en-US', label: 'English' }] as const,
        },
        pages: [],
        theme: {
          colors: {
            primary: '#8b5cf6',
          },
        },
      }

      const program = Effect.gen(function* () {
        const result1 = yield* compileCSS(app1)
        const result2 = yield* compileCSS(app2)
        return { result1, result2 }
      })

      const { result1, result2 } = await Effect.runPromise(program)

      // Different themes should produce different CSS
      expect(result1.css).not.toBe(result2.css)
      expect(result1.css).toContain('#3b82f6')
      expect(result2.css).toContain('#8b5cf6')
    })

    test('compiles CSS with complete theme configuration', async () => {
      const app: App = {
        name: 'Test App',
        description: 'Test',
        languages: {
          default: 'en',
          supported: [{ code: 'en', locale: 'en-US', label: 'English' }] as const,
        },
        pages: [],
        theme: {
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
          borderRadius: {
            sm: '0.125rem',
            md: '0.375rem',
          },
          shadows: {
            sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
          },
          breakpoints: {
            sm: '640px',
            md: '768px',
          },
        },
      }

      const program = Effect.gen(function* () {
        const result = yield* compileCSS(app)
        return result
      })

      const result = await Effect.runPromise(program)

      // Verify all theme tokens are present
      expect(result.css).toContain('--color-primary')
      expect(result.css).toContain('--font-sans')
      expect(result.css).toContain('--spacing-sm')
      expect(result.css).toContain('--radius-sm')
      expect(result.css).toContain('--shadow-sm')
      expect(result.css).toContain('--breakpoint-sm')
    })
  })
})
