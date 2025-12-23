/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for API Key Rate Limit Headers
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('API Key Rate Limit Headers', () => {
  test.fixme(
    'API-AUTH-API-KEY-HEADERS-001: should return X-RateLimit-Limit header with max requests',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Server with API key rate limiting configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: {
              rateLimit: {
                requestsPerMinute: 10,
              },
            },
          },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Rate Limited Key',
        },
      })

      const { key } = await keyResponse.json()

      // WHEN: Making a request with API key
      const response = await page.request.get('/api/users', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      })

      // THEN: Returns X-RateLimit-Limit header with max requests
      expect(response.status()).toBe(200)
      expect(response.headers()['x-ratelimit-limit']).toBe('10')
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-HEADERS-002: should return X-RateLimit-Remaining header with remaining requests',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Server with API key rate limiting
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: {
              rateLimit: {
                requestsPerMinute: 5,
              },
            },
          },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Rate Limited Key',
        },
      })

      const { key } = await keyResponse.json()

      // WHEN: Making first request
      const response1 = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${key}` },
      })

      // THEN: Returns X-RateLimit-Remaining with 4 remaining (5 - 1)
      expect(response1.status()).toBe(200)
      expect(response1.headers()['x-ratelimit-remaining']).toBe('4')

      // WHEN: Making second request
      const response2 = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${key}` },
      })

      // THEN: Returns X-RateLimit-Remaining with 3 remaining (5 - 2)
      expect(response2.status()).toBe(200)
      expect(response2.headers()['x-ratelimit-remaining']).toBe('3')
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-HEADERS-003: should return X-RateLimit-Reset header with reset timestamp',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Server with API key rate limiting
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: {
              rateLimit: {
                requestsPerMinute: 10,
              },
            },
          },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Rate Limited Key',
        },
      })

      const { key } = await keyResponse.json()

      // WHEN: Making a request
      const response = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${key}` },
      })

      // THEN: Returns X-RateLimit-Reset header with future timestamp
      expect(response.status()).toBe(200)
      const resetHeader = response.headers()['x-ratelimit-reset']
      expect(resetHeader).toBeDefined()

      const resetTimestamp = parseInt(resetHeader!)
      const now = Date.now()
      expect(resetTimestamp).toBeGreaterThan(now)
      expect(resetTimestamp).toBeLessThanOrEqual(now + 60 * 1000) // Within 1 minute
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-HEADERS-004: should return Retry-After header when rate limited',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Server with low rate limit
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: {
              rateLimit: {
                requestsPerMinute: 2,
              },
            },
          },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Rate Limited Key',
        },
      })

      const { key } = await keyResponse.json()

      // WHEN: Exhausting rate limit
      await page.request.get('/api/users', { headers: { Authorization: `Bearer ${key}` } })
      await page.request.get('/api/users', { headers: { Authorization: `Bearer ${key}` } })

      // Third request exceeds limit
      const response = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${key}` },
      })

      // THEN: Returns 429 with Retry-After header
      expect(response.status()).toBe(429)
      const retryAfter = response.headers()['retry-after']
      expect(retryAfter).toBeDefined()
      expect(parseInt(retryAfter!)).toBeGreaterThan(0)
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-HEADERS-005: should update headers after each request',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Server with rate limit
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: {
              rateLimit: {
                requestsPerMinute: 5,
              },
            },
          },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Rate Limited Key',
        },
      })

      const { key } = await keyResponse.json()

      // WHEN: Making multiple requests
      const responses = []
      for (let i = 0; i < 4; i++) {
        const response = await page.request.get('/api/users', {
          headers: { Authorization: `Bearer ${key}` },
        })
        responses.push(response)
      }

      // THEN: Remaining count decreases with each request
      expect(responses[0]!.headers()['x-ratelimit-remaining']).toBe('4') // 5 - 1
      expect(responses[1]!.headers()['x-ratelimit-remaining']).toBe('3') // 5 - 2
      expect(responses[2]!.headers()['x-ratelimit-remaining']).toBe('2') // 5 - 3
      expect(responses[3]!.headers()['x-ratelimit-remaining']).toBe('1') // 5 - 4
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-HEADERS-006: should include headers for different rate limit tiers',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Server with tiered rate limits
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: {
              rateLimit: {
                requestsPerMinute: 100,
                scopes: {
                  read: 100,
                  write: 20,
                },
              },
            },
          },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      const readKeyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Read Key',
          scope: 'read',
        },
      })

      const { key: readKey } = await readKeyResponse.json()

      const writeKeyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Write Key',
          scope: 'write',
        },
      })

      const { key: writeKey } = await writeKeyResponse.json()

      // WHEN: Making requests with different scope keys
      const readResponse = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${readKey}` },
      })

      const writeResponse = await page.request.post('/api/users', {
        headers: { Authorization: `Bearer ${writeKey}` },
        data: { name: 'New User', email: 'new@example.com' },
      })

      // THEN: Headers reflect different tier limits
      expect(readResponse.status()).toBe(200)
      expect(readResponse.headers()['x-ratelimit-limit']).toBe('100')
      expect(readResponse.headers()['x-ratelimit-remaining']).toBe('99')

      expect(writeResponse.status()).toBe(201)
      expect(writeResponse.headers()['x-ratelimit-limit']).toBe('20')
      expect(writeResponse.headers()['x-ratelimit-remaining']).toBe('19')
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-HEADERS-007: system can verify rate limit headers across request lifecycle',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Server with API key rate limiting
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: {
              rateLimit: {
                requestsPerMinute: 5,
              },
            },
          },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Rate Limited Key',
        },
      })

      const { key } = await keyResponse.json()

      // WHEN/THEN: First request shows full limit
      const response1 = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${key}` },
      })

      expect(response1.status()).toBe(200)
      expect(response1.headers()['x-ratelimit-limit']).toBe('5')
      expect(response1.headers()['x-ratelimit-remaining']).toBe('4')
      expect(response1.headers()['x-ratelimit-reset']).toBeDefined()

      // WHEN/THEN: Exhaust remaining requests
      for (let i = 0; i < 4; i++) {
        const response = await page.request.get('/api/users', {
          headers: { Authorization: `Bearer ${key}` },
        })
        expect(response.status()).toBe(200)
      }

      // WHEN/THEN: Next request exceeds limit
      const response6 = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${key}` },
      })

      expect(response6.status()).toBe(429)
      expect(response6.headers()['retry-after']).toBeDefined()
      expect(response6.headers()['x-ratelimit-remaining']).toBe('0')
    }
  )
})
