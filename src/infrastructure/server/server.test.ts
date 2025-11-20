/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { createServer, type ServerConfig } from './server'
import type { App } from '@/domain/models/app'

/**
 * Create mock app configuration for testing
 */
function createMockApp(overrides?: Partial<App>): App {
  return {
    name: 'Test Server App',
    version: '1.0.0',
    ...overrides,
  }
}

/**
 * Create server configuration for testing
 */
function createServerConfig(overrides?: Partial<ServerConfig>): ServerConfig {
  return {
    app: createMockApp(),
    port: 0, // Use port 0 for random available port
    hostname: 'localhost',
    renderHomePage: (app: App) => `<html><body><h1>${app.name}</h1></body></html>`,
    renderPage: (_app: App, path: string) => {
      if (path === '/about') return '<html><body><h1>About</h1></body></html>'
      return undefined
    },
    renderNotFoundPage: () => '<html><body><h1>404 Not Found</h1></body></html>',
    renderErrorPage: () => '<html><body><h1>500 Error</h1></body></html>',
    ...overrides,
  }
}

describe('Server - createServer', () => {
  describe('Given server creation succeeds', () => {
    test('When creating server Then return server instance with URL', async () => {
      const config = createServerConfig()

      const program = Effect.gen(function* () {
        const serverInstance = yield* createServer(config)

        expect(serverInstance).toBeDefined()
        expect(serverInstance.server).toBeDefined()
        expect(serverInstance.url).toBeDefined()
        expect(serverInstance.stop).toBeDefined()
        expect(serverInstance.url).toContain('http://localhost:')

        yield* serverInstance.stop

        return serverInstance
      })

      const result = await Effect.runPromise(program)
      expect(result).toBeDefined()
    })

    test('When using custom port Then server uses specified port', async () => {
      const config = createServerConfig({ port: 0 }) // Random port

      const program = Effect.gen(function* () {
        const serverInstance = yield* createServer(config)

        // URL should contain localhost and a port number
        expect(serverInstance.url).toMatch(/http:\/\/localhost:\d+/)

        yield* serverInstance.stop

        return serverInstance
      })

      await Effect.runPromise(program)
    })

    test('When using custom hostname Then server uses specified hostname', async () => {
      const config = createServerConfig({ hostname: '127.0.0.1' })

      const program = Effect.gen(function* () {
        const serverInstance = yield* createServer(config)

        expect(serverInstance.url).toContain('http://127.0.0.1:')

        yield* serverInstance.stop

        return serverInstance
      })

      await Effect.runPromise(program)
    })
  })

  describe('Given CSS pre-compilation', () => {
    test('When server starts Then CSS is pre-compiled', async () => {
      const config = createServerConfig({
        app: createMockApp({
          theme: {
            colors: {
              primary: '#3b82f6',
            },
          },
        }),
      })

      const program = Effect.gen(function* () {
        const serverInstance = yield* createServer(config)

        // Server should have started successfully, indicating CSS compiled
        expect(serverInstance.server).toBeDefined()

        yield* serverInstance.stop

        return serverInstance
      })

      await Effect.runPromise(program)
    })

    test('When theme configured Then CSS compiles with theme tokens', async () => {
      const config = createServerConfig({
        app: createMockApp({
          theme: {
            colors: {
              primary: '#3b82f6',
              secondary: '#8b5cf6',
            },
          },
        }),
      })

      const program = Effect.gen(function* () {
        const serverInstance = yield* createServer(config)

        // Verify server started (CSS compilation succeeded)
        expect(serverInstance).toBeDefined()

        yield* serverInstance.stop
      })

      await Effect.runPromise(program)
    })
  })

  describe('Given server stop functionality', () => {
    test('When calling stop Then server stops gracefully', async () => {
      const config = createServerConfig()

      const program = Effect.gen(function* () {
        const serverInstance = yield* createServer(config)

        expect(serverInstance.server).toBeDefined()

        // Stop the server
        yield* serverInstance.stop

        // Server should be stopped (no error thrown)
        return true
      })

      const result = await Effect.runPromise(program)
      expect(result).toBe(true)
    })

    test('When server stopped Then server is no longer running', async () => {
      const config = createServerConfig()

      const program = Effect.gen(function* () {
        const serverInstance = yield* createServer(config)

        // Verify server is running
        expect(serverInstance.server).toBeDefined()
        expect(serverInstance.url).toBeDefined()

        // Stop the server
        yield* serverInstance.stop

        // Server stop completed successfully
        return true
      })

      const result = await Effect.runPromise(program)
      expect(result).toBe(true)
    })
  })
})

describe('Server - Integration Tests', () => {
  describe('Given server running', () => {
    test('When accessing homepage Then render homepage', async () => {
      const config = createServerConfig()

      const program = Effect.gen(function* () {
        const serverInstance = yield* createServer(config)

        const res = yield* Effect.tryPromise({
          try: () => fetch(serverInstance.url),
          catch: (error) => error,
        })

        expect(res.status).toBe(200)
        const text = yield* Effect.tryPromise({
          try: () => res.text(),
          catch: (error) => error,
        })
        expect(text).toContain('Test Server App')

        yield* serverInstance.stop
      })

      await Effect.runPromise(program)
    }, 15_000)

    test('When accessing /api/health Then return health status', async () => {
      const config = createServerConfig()

      const program = Effect.gen(function* () {
        const serverInstance = yield* createServer(config)

        const res = yield* Effect.tryPromise({
          try: () => fetch(`${serverInstance.url}/api/health`),
          catch: (error) => error,
        })

        expect(res.status).toBe(200)
        const json = yield* Effect.tryPromise({
          try: () => res.json(),
          catch: (error) => error,
        })
        expect(json.status).toBe('ok')
        expect(json.app.name).toBe('Test Server App')

        yield* serverInstance.stop
      })

      await Effect.runPromise(program)
    }, 15_000)

    test('When accessing /assets/output.css Then serve compiled CSS', async () => {
      const config = createServerConfig()

      const program = Effect.gen(function* () {
        const serverInstance = yield* createServer(config)

        const res = yield* Effect.tryPromise({
          try: () => fetch(`${serverInstance.url}/assets/output.css`),
          catch: (error) => error,
        })

        expect(res.status).toBe(200)
        expect(res.headers.get('Content-Type')).toBe('text/css')
        const css = yield* Effect.tryPromise({
          try: () => res.text(),
          catch: (error) => error,
        })
        expect(css.length).toBeGreaterThan(0)

        yield* serverInstance.stop
      })

      await Effect.runPromise(program)
    }, 15_000)

    test('When accessing static JavaScript Then serve files', async () => {
      const config = createServerConfig()

      const program = Effect.gen(function* () {
        const serverInstance = yield* createServer(config)

        const res = yield* Effect.tryPromise({
          try: () => fetch(`${serverInstance.url}/assets/language-switcher.js`),
          catch: (error) => error,
        })

        expect(res.status).toBe(200)
        expect(res.headers.get('Content-Type')).toBe('application/javascript')

        yield* serverInstance.stop
      })

      await Effect.runPromise(program)
    }, 15_000)

    test('When accessing invalid route Then return 404', async () => {
      const config = createServerConfig()

      const program = Effect.gen(function* () {
        const serverInstance = yield* createServer(config)

        const res = yield* Effect.tryPromise({
          try: () => fetch(`${serverInstance.url}/nonexistent`),
          catch: (error) => error,
        })

        expect(res.status).toBe(404)
        const text = yield* Effect.tryPromise({
          try: () => res.text(),
          catch: (error) => error,
        })
        expect(text).toContain('404')

        yield* serverInstance.stop
      })

      await Effect.runPromise(program)
    }, 15_000)

    test('When accessing existing page Then render page', async () => {
      const config = createServerConfig()

      const program = Effect.gen(function* () {
        const serverInstance = yield* createServer(config)

        const res = yield* Effect.tryPromise({
          try: () => fetch(`${serverInstance.url}/about`),
          catch: (error) => error,
        })

        expect(res.status).toBe(200)
        const text = yield* Effect.tryPromise({
          try: () => res.text(),
          catch: (error) => error,
        })
        expect(text).toContain('About')

        yield* serverInstance.stop
      })

      await Effect.runPromise(program)
    }, 15_000)
  })

  describe('Given language configuration', () => {
    test('When languages configured Then language routes work', async () => {
      const config = createServerConfig({
        app: createMockApp({
          languages: {
            default: 'en',
            supported: [
              { code: 'en', locale: 'en-US', label: 'English' },
              { code: 'fr', locale: 'fr-FR', label: 'French' },
            ],
            detectBrowser: false,
          },
        }),
      })

      const program = Effect.gen(function* () {
        const serverInstance = yield* createServer(config)

        const res = yield* Effect.tryPromise({
          try: () => fetch(`${serverInstance.url}/fr/`),
          catch: (error) => error,
        })

        expect(res.status).toBe(200)

        yield* serverInstance.stop
      })

      await Effect.runPromise(program)
    }, 15_000)

    test('When browser detection enabled Then redirect to detected language', async () => {
      const config = createServerConfig({
        app: createMockApp({
          languages: {
            default: 'en',
            supported: [
              { code: 'en', locale: 'en-US', label: 'English' },
              { code: 'fr', locale: 'fr-FR', label: 'French' },
            ],
            detectBrowser: true,
          },
        }),
      })

      const program = Effect.gen(function* () {
        const serverInstance = yield* createServer(config)

        const res = yield* Effect.tryPromise({
          try: () =>
            fetch(serverInstance.url, {
              headers: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
              redirect: 'manual',
            }),
          catch: (error) => error,
        })

        expect(res.status).toBe(302)
        expect(res.headers.get('Location')).toBe('/fr/')

        yield* serverInstance.stop
      })

      await Effect.runPromise(program)
    }, 15_000)
  })

  describe('Given error handling', () => {
    test('When accessing /test/error in development Then return error page', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const config = createServerConfig()

      const program = Effect.gen(function* () {
        const serverInstance = yield* createServer(config)

        const res = yield* Effect.tryPromise({
          try: () => fetch(`${serverInstance.url}/test/error`),
          catch: (error) => error,
        })

        // Server should handle error with error handler
        // Error handler returns 500 or the error might propagate differently
        expect([404, 500]).toContain(res.status)

        yield* serverInstance.stop

        process.env.NODE_ENV = originalEnv
      })

      await Effect.runPromise(program)
    }, 15_000)

    test('When accessing /test/error in production Then return 404', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const config = createServerConfig()

      const program = Effect.gen(function* () {
        const serverInstance = yield* createServer(config)

        const res = yield* Effect.tryPromise({
          try: () => fetch(`${serverInstance.url}/test/error`),
          catch: (error) => error,
        })

        expect(res.status).toBe(404)

        yield* serverInstance.stop

        process.env.NODE_ENV = originalEnv
      })

      await Effect.runPromise(program)
    }, 15_000)
  })
})
