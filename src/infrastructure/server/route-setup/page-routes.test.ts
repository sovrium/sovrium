/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test, mock } from 'bun:test'
import { Hono } from 'hono'
import {
  setupHomepageRoute,
  setupLanguageRoutes,
  setupDynamicPageRoutes,
  setupTestErrorRoute,
  setupPageRoutes,
  type HonoAppConfig,
} from './page-routes'
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

/**
 * Create mock configuration for route setup testing
 */
function createMockConfig(overrides?: Partial<HonoAppConfig>): HonoAppConfig {
  return {
    app: createMockApp(),
    renderHomePage: mock(() => '<html>Home</html>'),
    renderPage: mock(() => '<html>Page</html>'),
    renderNotFoundPage: mock(() => '<html>404</html>'),
    renderErrorPage: mock(() => '<html>500</html>'),
    ...overrides,
  }
}

describe('Page Routes - setupHomepageRoute', () => {
  describe('Given no languages configured', () => {
    test('When accessing homepage Then serve default homepage', async () => {
      const config = createMockConfig({
        app: createMockApp({ languages: undefined }),
      })
      const app = setupHomepageRoute(new Hono(), config)

      const res = await app.request('/')

      expect(res.status).toBe(200)
      expect(config.renderHomePage).toHaveBeenCalledWith(config.app, undefined)
      expect(await res.text()).toContain('Home')
    })
  })

  describe('Given browser detection disabled', () => {
    test('When accessing homepage Then serve default at /', async () => {
      const config = createMockConfig({
        app: createMockApp({
          languages: {
            default: 'en-US',
            supported: [
              { code: 'en-US', label: 'English' },
              { code: 'fr-FR', label: 'French' },
            ],
            detectBrowser: false,
          },
        }),
      })
      const app = setupHomepageRoute(new Hono(), config)

      const res = await app.request('/')

      expect(res.status).toBe(200)
      expect(config.renderHomePage).toHaveBeenCalledWith(config.app, undefined)
    })

    test('When accessing homepage with Accept-Language header Then ignore header', async () => {
      const config = createMockConfig({
        app: createMockApp({
          languages: {
            default: 'en-US',
            supported: [
              { code: 'en-US', label: 'English' },
              { code: 'fr-FR', label: 'French' },
            ],
            detectBrowser: false,
          },
        }),
      })
      const app = setupHomepageRoute(new Hono(), config)

      const res = await app.request('/', {
        headers: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
      })

      expect(res.status).toBe(200)
      expect(config.renderHomePage).toHaveBeenCalledWith(config.app, undefined)
    })
  })

  describe('Given browser detection enabled', () => {
    test('When detected language equals default Then serve at / without redirect', async () => {
      const config = createMockConfig({
        app: createMockApp({
          languages: {
            default: 'en-US',
            supported: [
              { code: 'en-US', label: 'English' },
              { code: 'fr-FR', label: 'French' },
            ],
            detectBrowser: true,
          },
        }),
      })
      const app = setupHomepageRoute(new Hono(), config)

      const res = await app.request('/', {
        headers: { 'Accept-Language': 'en-US,en;q=0.9' },
      })

      expect(res.status).toBe(200)
      expect(config.renderHomePage).toHaveBeenCalledWith(config.app, undefined)
    })

    test('When detected language differs from default Then redirect to /:lang/', async () => {
      const config = createMockConfig({
        app: createMockApp({
          languages: {
            default: 'en-US',
            supported: [
              { code: 'en-US', label: 'English' },
              { code: 'fr-FR', label: 'French' },
            ],
            detectBrowser: true,
          },
        }),
      })
      const app = setupHomepageRoute(new Hono(), config)

      const res = await app.request('/', {
        headers: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
        redirect: 'manual',
      })

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/fr-FR/')
    })

    test('When no Accept-Language header Then serve default without redirect', async () => {
      const config = createMockConfig({
        app: createMockApp({
          languages: {
            default: 'en-US',
            supported: [
              { code: 'en-US', label: 'English' },
              { code: 'fr-FR', label: 'French' },
            ],
            detectBrowser: true,
          },
        }),
      })
      const app = setupHomepageRoute(new Hono(), config)

      const res = await app.request('/')

      expect(res.status).toBe(200)
      expect(config.renderHomePage).toHaveBeenCalledWith(config.app, undefined)
    })

    test('When unsupported language detected Then serve default', async () => {
      const config = createMockConfig({
        app: createMockApp({
          languages: {
            default: 'en-US',
            supported: [
              { code: 'en-US', label: 'English' },
              { code: 'fr-FR', label: 'French' },
            ],
            detectBrowser: true,
          },
        }),
      })
      const app = setupHomepageRoute(new Hono(), config)

      const res = await app.request('/', {
        headers: { 'Accept-Language': 'de-DE,de;q=0.9' },
      })

      expect(res.status).toBe(200)
      expect(config.renderHomePage).toHaveBeenCalledWith(config.app, undefined)
    })
  })

  describe('Given error occurs during rendering', () => {
    test('When renderHomePage throws Then return error page with 500 status', async () => {
      const config = createMockConfig({
        renderHomePage: mock(() => {
          throw new Error('Rendering failed')
        }),
      })
      const app = setupHomepageRoute(new Hono(), config)

      const res = await app.request('/')

      expect(res.status).toBe(500)
      expect(config.renderErrorPage).toHaveBeenCalled()
      expect(await res.text()).toContain('500')
    })
  })
})

describe('Page Routes - setupLanguageRoutes', () => {
  describe('Given /:lang/ route accessed', () => {
    test('When exact page match exists Then serve page instead of homepage', async () => {
      const mockRenderPage = mock(() => '<html>Exact Page</html>')
      const config = createMockConfig({
        app: createMockApp({
          languages: {
            default: 'en-US',
            supported: [
              { code: 'en-US', label: 'English' },
              { code: 'fr-FR', label: 'French' },
            ],
            detectBrowser: true,
          },
        }),
        renderPage: mockRenderPage,
      })
      const app = setupLanguageRoutes(new Hono(), config)

      const res = await app.request('/fr-FR/')

      expect(res.status).toBe(200)
      expect(mockRenderPage).toHaveBeenCalled()
      expect(await res.text()).toContain('Exact Page')
    })

    test('When valid language subdirectory Then serve homepage in that language', async () => {
      const mockRenderPage = mock(() => undefined)
      const config = createMockConfig({
        app: createMockApp({
          languages: {
            default: 'en-US',
            supported: [
              { code: 'en-US', label: 'English' },
              { code: 'fr-FR', label: 'French' },
            ],
            detectBrowser: true,
          },
        }),
        renderPage: mockRenderPage,
      })
      const app = setupLanguageRoutes(new Hono(), config)

      const res = await app.request('/fr-FR/')

      expect(res.status).toBe(200)
      expect(config.renderHomePage).toHaveBeenCalledWith(config.app, 'fr-FR')
    })

    test('When invalid language subdirectory Then return 404', async () => {
      const mockRenderPage = mock(() => undefined)
      const config = createMockConfig({
        app: createMockApp({
          languages: {
            default: 'en-US',
            supported: [
              { code: 'en-US', label: 'English' },
              { code: 'fr-FR', label: 'French' },
            ],
            detectBrowser: true,
          },
        }),
        renderPage: mockRenderPage,
      })
      const app = setupLanguageRoutes(new Hono(), config)

      const res = await app.request('/invalid/')

      expect(res.status).toBe(404)
      expect(config.renderNotFoundPage).toHaveBeenCalled()
    })

    test('When error occurs Then return error page with 500 status', async () => {
      const config = createMockConfig({
        renderHomePage: mock(() => {
          throw new Error('Rendering failed')
        }),
        renderPage: mock(() => undefined),
        app: createMockApp({
          languages: {
            default: 'en-US',
            supported: [{ code: 'en-US', label: 'English' }],
            detectBrowser: false,
          },
        }),
      })
      const app = setupLanguageRoutes(new Hono(), config)

      const res = await app.request('/en-US/')

      expect(res.status).toBe(500)
      expect(config.renderErrorPage).toHaveBeenCalled()
    })
  })

  describe('Given /:lang/* route accessed', () => {
    test('When exact page match exists Then serve page', async () => {
      const mockRenderPage = mock(() => '<html>Page Content</html>')
      const config = createMockConfig({
        app: createMockApp({
          languages: {
            default: 'en-US',
            supported: [
              { code: 'en-US', label: 'English' },
              { code: 'fr-FR', label: 'French' },
            ],
            detectBrowser: true,
          },
        }),
        renderPage: mockRenderPage,
      })
      const app = setupLanguageRoutes(new Hono(), config)

      const res = await app.request('/fr-FR/about')

      expect(res.status).toBe(200)
      expect(await res.text()).toContain('Page Content')
    })

    test('When valid language subdirectory and page exists Then serve page in language', async () => {
      const mockRenderPage = mock((_app: App, path: string) => {
        if (path === '/fr-FR/about') return undefined
        if (path === '/about') return '<html>About in French</html>'
        return undefined
      })
      const config = createMockConfig({
        app: createMockApp({
          languages: {
            default: 'en-US',
            supported: [
              { code: 'en-US', label: 'English' },
              { code: 'fr-FR', label: 'French' },
            ],
            detectBrowser: true,
          },
        }),
        renderPage: mockRenderPage,
      })
      const app = setupLanguageRoutes(new Hono(), config)

      const res = await app.request('/fr-FR/about')

      expect(res.status).toBe(200)
      expect(await res.text()).toContain('About in French')
    })

    test('When invalid language subdirectory Then return 404', async () => {
      const mockRenderPage = mock(() => undefined)
      const config = createMockConfig({
        app: createMockApp({
          languages: {
            default: 'en-US',
            supported: [
              { code: 'en-US', label: 'English' },
              { code: 'fr-FR', label: 'French' },
            ],
            detectBrowser: true,
          },
        }),
        renderPage: mockRenderPage,
      })
      const app = setupLanguageRoutes(new Hono(), config)

      const res = await app.request('/invalid/about')

      expect(res.status).toBe(404)
      expect(config.renderNotFoundPage).toHaveBeenCalled()
    })

    test('When valid language but page not found Then return 404', async () => {
      const mockRenderPage = mock(() => undefined)
      const config = createMockConfig({
        app: createMockApp({
          languages: {
            default: 'en-US',
            supported: [
              { code: 'en-US', label: 'English' },
              { code: 'fr-FR', label: 'French' },
            ],
            detectBrowser: true,
          },
        }),
        renderPage: mockRenderPage,
      })
      const app = setupLanguageRoutes(new Hono(), config)

      const res = await app.request('/fr-FR/nonexistent')

      expect(res.status).toBe(404)
      expect(config.renderNotFoundPage).toHaveBeenCalled()
    })

    test('When error occurs Then return error page with 500 status', async () => {
      const mockRenderPage = mock(() => {
        throw new Error('Rendering failed')
      })
      const mockRenderErrorPage = mock(() => '<html>Error Page</html>')
      const config = createMockConfig({
        renderPage: mockRenderPage,
        renderErrorPage: mockRenderErrorPage,
        app: createMockApp({
          languages: {
            default: 'en-US',
            supported: [{ code: 'en-US', label: 'English' }],
            detectBrowser: false,
          },
        }),
      })
      const app = setupLanguageRoutes(new Hono(), config)

      const res = await app.request('/en-US/about')

      expect(res.status).toBe(500)
      expect(mockRenderErrorPage).toHaveBeenCalled()
      expect(await res.text()).toContain('Error Page')
    })
  })
})

describe('Page Routes - setupDynamicPageRoutes', () => {
  describe('Given catch-all route', () => {
    test('When page exists Then serve page', async () => {
      const mockRenderPage = mock(() => '<html>Dynamic Page</html>')
      const config = createMockConfig({
        renderPage: mockRenderPage,
      })
      const app = setupDynamicPageRoutes(new Hono(), config)

      const res = await app.request('/about')

      expect(res.status).toBe(200)
      expect(mockRenderPage).toHaveBeenCalledWith(config.app, '/about', undefined)
      expect(await res.text()).toContain('Dynamic Page')
    })

    test('When page not found Then return 404', async () => {
      const mockRenderPage = mock(() => undefined)
      const config = createMockConfig({
        renderPage: mockRenderPage,
      })
      const app = setupDynamicPageRoutes(new Hono(), config)

      const res = await app.request('/nonexistent')

      expect(res.status).toBe(404)
      expect(config.renderNotFoundPage).toHaveBeenCalled()
    })

    test('When browser detection enabled Then pass detected language', async () => {
      const mockRenderPage = mock(() => '<html>Page</html>')
      const config = createMockConfig({
        app: createMockApp({
          languages: {
            default: 'en-US',
            supported: [
              { code: 'en-US', label: 'English' },
              { code: 'fr-FR', label: 'French' },
            ],
            detectBrowser: true,
          },
        }),
        renderPage: mockRenderPage,
      })
      const app = setupDynamicPageRoutes(new Hono(), config)

      await app.request('/about', {
        headers: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
      })

      expect(mockRenderPage).toHaveBeenCalledWith(config.app, '/about', 'fr-FR')
    })
  })
})

describe('Page Routes - setupTestErrorRoute', () => {
  describe('Given non-production environment', () => {
    test('When accessing /test/error Then throw test error', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const config = createMockConfig()
      const app = setupTestErrorRoute(new Hono(), config).onError((error, c) => {
        // Verify error was thrown
        expect(error.message).toBe('Test error')
        return c.html('<html>500</html>', 500)
      })

      const res = await app.request('/test/error')

      // Error should be caught by error handler
      expect(res.status).toBe(500)

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('Given production environment', () => {
    test('When accessing /test/error Then return 404', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const config = createMockConfig()
      const app = setupTestErrorRoute(new Hono(), config)

      const res = await app.request('/test/error')

      expect(res.status).toBe(404)
      expect(config.renderNotFoundPage).toHaveBeenCalled()

      process.env.NODE_ENV = originalEnv
    })
  })
})

describe('Page Routes - setupPageRoutes (Integration)', () => {
  test('When all routes mounted Then routes work together correctly', async () => {
    const mockRenderPage = mock((_app: App, path: string) => {
      if (path === '/about') return '<html>About</html>'
      return undefined
    })
    const config = createMockConfig({
      app: createMockApp({
        languages: {
          default: 'en-US',
          supported: [
            { code: 'en-US', label: 'English' },
            { code: 'fr-FR', label: 'French' },
          ],
          detectBrowser: true,
        },
      }),
      renderPage: mockRenderPage,
    })
    const app = setupPageRoutes(new Hono(), config)

    // Test homepage
    const homeRes = await app.request('/')
    expect(homeRes.status).toBe(200)

    // Test language route
    const langRes = await app.request('/fr-FR/')
    expect(langRes.status).toBe(200)

    // Test dynamic page
    const pageRes = await app.request('/about')
    expect(pageRes.status).toBe(200)
    expect(await pageRes.text()).toContain('About')
  })

  test('When mounting order is correct Then test error route accessible', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    const config = createMockConfig()
    const app = setupPageRoutes(new Hono(), config).onError((_error, c) => {
      return c.html('<html>500</html>', 500)
    })

    const res = await app.request('/test/error')

    // Error is caught by error handler and returns 500
    expect(res.status).toBe(500)

    process.env.NODE_ENV = originalEnv
  })
})
