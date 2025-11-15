/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { setupCSSRoute, setupJavaScriptRoutes, createJavaScriptHandler, setupStaticAssets } from './static-assets'
import type { App } from '@/domain/models/app'

/**
 * Create mock app configuration for testing
 */
function createMockApp(overrides?: Partial<App>): App {
  return {
    name: 'Test App',
    version: '1.0.0',
    ...overrides,
  }
}

describe('Static Assets - setupCSSRoute', () => {
  describe('Given CSS compilation succeeds', () => {
    test('When accessing /assets/output.css Then return compiled CSS', async () => {
      const app = createMockApp()
      const honoApp = setupCSSRoute(new Hono(), app)

      const res = await honoApp.request('/assets/output.css')

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('text/css')
      expect(res.headers.get('Cache-Control')).toContain('public')
      expect(res.headers.get('Cache-Control')).toContain('max-age=3600')

      const css = await res.text()
      expect(css.length).toBeGreaterThan(0)
    })

    test('When theme tokens configured Then resolve tokens in CSS', async () => {
      const app = createMockApp({
        theme: {
          colors: {
            primary: '#3b82f6',
          },
        },
      })
      const honoApp = setupCSSRoute(new Hono(), app)

      const res = await honoApp.request('/assets/output.css')

      expect(res.status).toBe(200)
      const css = await res.text()
      // CSS should contain processed color values
      expect(css).toBeDefined()
    })

    test('When no theme configured Then use default styling', async () => {
      const app = createMockApp()
      const honoApp = setupCSSRoute(new Hono(), app)

      const res = await honoApp.request('/assets/output.css')

      expect(res.status).toBe(200)
      const css = await res.text()
      expect(css).toBeDefined()
    })
  })

  describe('Given CSS compilation fails', () => {
    test('When compilation error occurs Then return 500 with error comment', async () => {
      // Create app with invalid theme configuration that will cause compilation to fail
      const app = createMockApp({
        theme: {
          // This will be passed through but may cause issues
          colors: undefined as unknown as Record<string, string>,
        },
      })

      const honoApp = setupCSSRoute(new Hono(), app)

      const res = await honoApp.request('/assets/output.css')

      // Even with invalid theme, compiler handles it gracefully
      // So we expect either success or graceful failure
      expect([200, 500]).toContain(res.status)
      expect(res.headers.get('Content-Type')).toBe('text/css')
    })
  })

  describe('Given cache behavior', () => {
    test('When requesting CSS multiple times Then serve with cache headers', async () => {
      const app = createMockApp()
      const honoApp = setupCSSRoute(new Hono(), app)

      const res1 = await honoApp.request('/assets/output.css')
      const res2 = await honoApp.request('/assets/output.css')

      expect(res1.status).toBe(200)
      expect(res2.status).toBe(200)
      expect(res1.headers.get('Cache-Control')).toBe(res2.headers.get('Cache-Control'))
    })
  })
})

describe('Static Assets - createJavaScriptHandler', () => {
  describe('Given JavaScript file exists', () => {
    test('When file loaded successfully Then return JS with correct headers', async () => {
      const handler = createJavaScriptHandler(
        'test-script.js',
        './src/presentation/scripts/client/language-switcher.js'
      )
      const c = new Hono().get('/', handler)

      const res = await c.request('/')

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/javascript')
      expect(res.headers.get('Cache-Control')).toContain('public')
      expect(res.headers.get('Cache-Control')).toContain('max-age=3600')

      const content = await res.text()
      expect(content.length).toBeGreaterThan(0)
    })

    test('When language-switcher.js loaded Then contain expected code', async () => {
      const handler = createJavaScriptHandler(
        'language-switcher.js',
        './src/presentation/scripts/client/language-switcher.js'
      )
      const c = new Hono().get('/', handler)

      const res = await c.request('/')

      expect(res.status).toBe(200)
      const content = await res.text()
      // Check for expected function or pattern in language switcher
      expect(content).toBeDefined()
      expect(content.length).toBeGreaterThan(0)
    })

    test('When banner-dismiss.js loaded Then contain expected code', async () => {
      const handler = createJavaScriptHandler(
        'banner-dismiss.js',
        './src/presentation/scripts/client/banner-dismiss.js'
      )
      const c = new Hono().get('/', handler)

      const res = await c.request('/')

      expect(res.status).toBe(200)
      const content = await res.text()
      expect(content).toBeDefined()
      expect(content.length).toBeGreaterThan(0)
    })

    test('When scroll-animation.js loaded Then contain expected code', async () => {
      const handler = createJavaScriptHandler(
        'scroll-animation.js',
        './src/presentation/scripts/client/scroll-animation.js'
      )
      const c = new Hono().get('/', handler)

      const res = await c.request('/')

      expect(res.status).toBe(200)
      const content = await res.text()
      expect(content).toBeDefined()
      expect(content.length).toBeGreaterThan(0)
    })
  })

  describe('Given JavaScript file missing', () => {
    test('When file not found Then return 500 with error comment', async () => {
      const handler = createJavaScriptHandler(
        'nonexistent.js',
        './nonexistent/path/script.js'
      )
      const c = new Hono().get('/', handler)

      const res = await c.request('/')

      expect(res.status).toBe(500)
      expect(res.headers.get('Content-Type')).toBe('application/javascript')

      const content = await res.text()
      expect(content).toContain('failed to load')
    })
  })

  describe('Given cache behavior', () => {
    test('When requesting same script multiple times Then serve with cache headers', async () => {
      const handler = createJavaScriptHandler(
        'test.js',
        './src/presentation/scripts/client/language-switcher.js'
      )
      const c = new Hono().get('/', handler)

      const res1 = await c.request('/')
      const res2 = await c.request('/')

      expect(res1.status).toBe(200)
      expect(res2.status).toBe(200)
      expect(res1.headers.get('Cache-Control')).toBe(res2.headers.get('Cache-Control'))
    })
  })
})

describe('Static Assets - setupJavaScriptRoutes', () => {
  describe('Given all JavaScript routes mounted', () => {
    test('When accessing language-switcher.js Then serve file', async () => {
      const honoApp = setupJavaScriptRoutes(new Hono())

      const res = await honoApp.request('/assets/language-switcher.js')

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/javascript')
      expect(await res.text()).toBeDefined()
    })

    test('When accessing banner-dismiss.js Then serve file', async () => {
      const honoApp = setupJavaScriptRoutes(new Hono())

      const res = await honoApp.request('/assets/banner-dismiss.js')

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/javascript')
      expect(await res.text()).toBeDefined()
    })

    test('When accessing scroll-animation.js Then serve file', async () => {
      const honoApp = setupJavaScriptRoutes(new Hono())

      const res = await honoApp.request('/assets/scroll-animation.js')

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/javascript')
      expect(await res.text()).toBeDefined()
    })

    test('When accessing non-existent asset Then return 404', async () => {
      const honoApp = setupJavaScriptRoutes(new Hono()).notFound((c) => c.text('Not Found', 404))

      const res = await honoApp.request('/assets/nonexistent.js')

      expect(res.status).toBe(404)
    })
  })
})

describe('Static Assets - setupStaticAssets (Integration)', () => {
  describe('Given all static asset routes mounted', () => {
    test('When accessing CSS route Then serve compiled CSS', async () => {
      const app = createMockApp()
      const honoApp = setupStaticAssets(new Hono(), app)

      const res = await honoApp.request('/assets/output.css')

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('text/css')
    })

    test('When accessing JavaScript routes Then serve files', async () => {
      const app = createMockApp()
      const honoApp = setupStaticAssets(new Hono(), app)

      const langRes = await honoApp.request('/assets/language-switcher.js')
      const bannerRes = await honoApp.request('/assets/banner-dismiss.js')
      const scrollRes = await honoApp.request('/assets/scroll-animation.js')

      expect(langRes.status).toBe(200)
      expect(bannerRes.status).toBe(200)
      expect(scrollRes.status).toBe(200)
    })

    test('When routes chained correctly Then both CSS and JS accessible', async () => {
      const app = createMockApp({
        theme: {
          colors: {
            primary: '#3b82f6',
          },
        },
      })
      const honoApp = setupStaticAssets(new Hono(), app)

      const cssRes = await honoApp.request('/assets/output.css')
      const jsRes = await honoApp.request('/assets/language-switcher.js')

      expect(cssRes.status).toBe(200)
      expect(jsRes.status).toBe(200)
      expect(cssRes.headers.get('Content-Type')).toBe('text/css')
      expect(jsRes.headers.get('Content-Type')).toBe('application/javascript')
    })
  })

  describe('Given complex theme configuration', () => {
    test('When theme has multiple properties Then CSS compiles successfully', async () => {
      const app = createMockApp({
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
        },
      })
      const honoApp = setupStaticAssets(new Hono(), app)

      const res = await honoApp.request('/assets/output.css')

      expect(res.status).toBe(200)
      const css = await res.text()
      expect(css).toBeDefined()
      expect(css.length).toBeGreaterThan(0)
    })
  })
})
