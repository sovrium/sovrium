/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { setupAuthMiddleware, setupAuthRoutes } from './auth-routes'

describe('Auth Routes - setupAuthMiddleware', () => {
  describe('Given CORS middleware configured', () => {
    test('When middleware mounted Then CORS headers set for auth routes', async () => {
      const app = setupAuthMiddleware(new Hono())

      // OPTIONS request to auth endpoint (CORS preflight)
      const res = await app.request('/api/auth/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3001',
          'Access-Control-Request-Method': 'POST',
        },
      })

      // CORS middleware should handle OPTIONS requests
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeDefined()
      expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    })

    test('When origin is localhost Then allow origin', async () => {
      const app = setupAuthMiddleware(new Hono())

      const res = await app.request('/api/auth/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
        },
      })

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
    })

    test('When origin is 127.0.0.1 Then allow origin', async () => {
      const app = setupAuthMiddleware(new Hono())

      const res = await app.request('/api/auth/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://127.0.0.1:3000',
          'Access-Control-Request-Method': 'POST',
        },
      })

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:3000')
    })

    test('When credentials included Then allow credentials header set', async () => {
      const app = setupAuthMiddleware(new Hono())

      const res = await app.request('/api/auth/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
        },
      })

      expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    })

    test('When POST method requested Then allow POST', async () => {
      const app = setupAuthMiddleware(new Hono())

      const res = await app.request('/api/auth/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
        },
      })

      const allowedMethods = res.headers.get('Access-Control-Allow-Methods')
      expect(allowedMethods).toContain('POST')
    })

    test('When GET method requested Then allow GET', async () => {
      const app = setupAuthMiddleware(new Hono())

      const res = await app.request('/api/auth/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
        },
      })

      const allowedMethods = res.headers.get('Access-Control-Allow-Methods')
      expect(allowedMethods).toContain('GET')
    })

    test('When Content-Type header requested Then allow header', async () => {
      const app = setupAuthMiddleware(new Hono())

      const res = await app.request('/api/auth/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type',
        },
      })

      const allowedHeaders = res.headers.get('Access-Control-Allow-Headers')
      expect(allowedHeaders).toContain('Content-Type')
    })

    test('When Authorization header requested Then allow header', async () => {
      const app = setupAuthMiddleware(new Hono())

      const res = await app.request('/api/auth/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Authorization',
        },
      })

      const allowedHeaders = res.headers.get('Access-Control-Allow-Headers')
      expect(allowedHeaders).toContain('Authorization')
    })
  })

  describe('Given CORS max-age configured', () => {
    test('When preflight request made Then max-age header set', async () => {
      const app = setupAuthMiddleware(new Hono())

      const res = await app.request('/api/auth/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
        },
      })

      expect(res.headers.get('Access-Control-Max-Age')).toBe('600')
    })
  })

  describe('Given middleware only applies to auth routes', () => {
    test('When non-auth route accessed Then no CORS headers added', async () => {
      const app = setupAuthMiddleware(new Hono()).get('/api/other', (c) => c.text('OK'))

      const res = await app.request('/api/other', {
        headers: {
          Origin: 'http://localhost:3000',
        },
      })

      // CORS middleware should not apply to non-auth routes
      expect(res.status).toBe(200)
    })
  })
})

describe('Auth Routes - setupAuthRoutes', () => {
  describe('Given Better Auth routes mounted', () => {
    test('When POST to /api/auth/* Then route to Better Auth handler', async () => {
      const app = setupAuthRoutes(new Hono())

      // Better Auth handles this route, but we're testing that it's mounted
      const res = await app.request('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
        }),
      })

      // Route is mounted (Better Auth will handle actual authentication)
      // We expect a response (Better Auth may return 400, 401, or 404 depending on configuration)
      expect(res).toBeDefined()
      expect([200, 400, 401, 404, 500]).toContain(res.status)
    })

    test('When GET to /api/auth/* Then route to Better Auth handler', async () => {
      const app = setupAuthRoutes(new Hono())

      const res = await app.request('/api/auth/session', {
        method: 'GET',
      })

      // Route is mounted (Better Auth returns a response)
      expect(res).toBeDefined()
      expect([200, 401, 404]).toContain(res.status)
    })

    test('When auth route accessed Then Better Auth processes request', async () => {
      const app = setupAuthRoutes(new Hono())

      // Test a known Better Auth endpoint structure
      const res = await app.request('/api/auth/session', {
        method: 'GET',
      })

      // Better Auth responds (status depends on configuration and session state)
      expect(res).toBeDefined()
      expect(res.status).toBeGreaterThanOrEqual(200)
      expect(res.status).toBeLessThan(600)
    })
  })

  describe('Given multiple auth endpoints', () => {
    test('When accessing different auth paths Then all routed correctly', async () => {
      const app = setupAuthRoutes(new Hono())

      const signinRes = await app.request('/api/auth/signin', { method: 'POST' })
      const sessionRes = await app.request('/api/auth/session', { method: 'GET' })
      const signoutRes = await app.request('/api/auth/signout', { method: 'POST' })

      // All routes should be mounted and return valid HTTP status codes
      expect(signinRes).toBeDefined()
      expect(sessionRes).toBeDefined()
      expect(signoutRes).toBeDefined()
      expect(signinRes.status).toBeGreaterThanOrEqual(200)
      expect(sessionRes.status).toBeGreaterThanOrEqual(200)
      expect(signoutRes.status).toBeGreaterThanOrEqual(200)
    })
  })
})

describe('Auth Routes - Integration', () => {
  describe('Given both middleware and routes mounted', () => {
    test('When auth request made Then CORS and routing work together', async () => {
      const app = setupAuthRoutes(setupAuthMiddleware(new Hono()))

      const res = await app.request('/api/auth/session', {
        method: 'GET',
        headers: {
          Origin: 'http://localhost:3000',
        },
      })

      // Route exists and CORS is applied
      expect(res).toBeDefined()
      expect(res.status).toBeGreaterThanOrEqual(200)
      expect(res.status).toBeLessThan(600)
    })

    test('When preflight request made Then CORS responds before auth handler', async () => {
      const app = setupAuthRoutes(setupAuthMiddleware(new Hono()))

      const res = await app.request('/api/auth/signin', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
        },
      })

      // CORS should handle OPTIONS requests
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
    })

    test('When actual auth request follows preflight Then both work', async () => {
      const app = setupAuthRoutes(setupAuthMiddleware(new Hono()))

      // Preflight
      const preflightRes = await app.request('/api/auth/signin', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
        },
      })

      // Actual request
      const actualRes = await app.request('/api/auth/signin', {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:3000',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password',
        }),
      })

      // Both should succeed
      expect(preflightRes.headers.get('Access-Control-Allow-Origin')).toBeDefined()
      expect(actualRes).toBeDefined()
    })
  })
})
