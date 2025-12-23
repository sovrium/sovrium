/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for API Key Sliding Window Rate Limiting
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('API Key Sliding Window Rate Limiting', () => {
  test.fixme(
    'API-AUTH-API-KEY-RATE-LIMIT-001: should allow requests within rate limit window',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Server with sliding window rate limiting
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: {
              rateLimit: {
                requestsPerMinute: 30, // 5 per 10 seconds = 30 per minute
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

      // WHEN: Making requests within limit
      const responses = []
      for (let i = 0; i < 5; i++) {
        const response = await page.request.get('/api/users', {
          headers: { Authorization: `Bearer ${key}` },
        })
        responses.push(response)
      }

      // THEN: All requests succeed
      expect(responses.every((r) => r.status() === 200)).toBe(true)
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-RATE-LIMIT-002: should return 429 when rate limit exceeded',
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
                requestsPerMinute: 18, // 3 per 10 seconds = 18 per minute
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

      // WHEN: Exceeding rate limit
      await page.request.get('/api/users', { headers: { Authorization: `Bearer ${key}` } })
      await page.request.get('/api/users', { headers: { Authorization: `Bearer ${key}` } })
      await page.request.get('/api/users', { headers: { Authorization: `Bearer ${key}` } })

      // Fourth request exceeds limit
      const response = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${key}` },
      })

      // THEN: Returns 429 Too Many Requests
      expect(response.status()).toBe(429)
      const data = await response.json()
      expect(data.error).toContain('rate limit')
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-RATE-LIMIT-003: should reset rate limit after time window',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Server with short window
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: {
              rateLimit: {
                requestsPerMinute: 60, // 2 per 2 seconds = 60 per minute
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

      const response1 = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${key}` },
      })

      expect(response1.status()).toBe(429)

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 2100))

      // Request after window reset
      const response2 = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${key}` },
      })

      // THEN: Rate limit resets, request succeeds
      expect(response2.status()).toBe(200)
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-RATE-LIMIT-004: should apply different limits per key scope',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Server with scope-based rate limits
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: {
              rateLimit: {
                requestsPerMinute: 60,
                actionLimits: {
                  read: 60,
                  write: 18,
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

      // WHEN: Making requests with read key (limit 10)
      const readResponses = []
      for (let i = 0; i < 10; i++) {
        const response = await page.request.get('/api/users', {
          headers: { Authorization: `Bearer ${readKey}` },
        })
        readResponses.push(response)
      }

      // THEN: Read key allows 10 requests
      expect(readResponses.every((r) => r.status() === 200)).toBe(true)

      // WHEN: Making requests with write key (limit 3)
      await page.request.post('/api/users', {
        headers: { Authorization: `Bearer ${writeKey}` },
        data: { name: 'User1', email: 'user1@example.com' },
      })
      await page.request.post('/api/users', {
        headers: { Authorization: `Bearer ${writeKey}` },
        data: { name: 'User2', email: 'user2@example.com' },
      })
      await page.request.post('/api/users', {
        headers: { Authorization: `Bearer ${writeKey}` },
        data: { name: 'User3', email: 'user3@example.com' },
      })

      const writeResponse4 = await page.request.post('/api/users', {
        headers: { Authorization: `Bearer ${writeKey}` },
        data: { name: 'User4', email: 'user4@example.com' },
      })

      // THEN: Write key blocks after 3 requests
      expect(writeResponse4.status()).toBe(429)
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-RATE-LIMIT-005: should track sliding window correctly',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Server with sliding window
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: {
              rateLimit: {
                requestsPerMinute: 36, // 3 per 5 seconds = 36 per minute
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

      // WHEN: Making staggered requests
      const response1 = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${key}` },
      })
      expect(response1.status()).toBe(200)

      await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait 1s

      const response2 = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${key}` },
      })
      expect(response2.status()).toBe(200)

      await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait 1s

      const response3 = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${key}` },
      })
      expect(response3.status()).toBe(200)

      // Fourth request within window
      const response4 = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${key}` },
      })

      // THEN: Fourth request blocked (3 requests in 5s window)
      expect(response4.status()).toBe(429)

      // Wait for first request to exit window
      await new Promise((resolve) => setTimeout(resolve, 3100))

      // Request after first one exits window
      const response5 = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${key}` },
      })

      // THEN: Request succeeds (sliding window)
      expect(response5.status()).toBe(200)
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-RATE-LIMIT-006: should handle concurrent requests accurately',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Server with rate limiting
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: {
              rateLimit: {
                requestsPerMinute: 30, // 5 per 10 seconds = 30 per minute
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

      // WHEN: Making concurrent requests
      const requests = []
      for (let i = 0; i < 10; i++) {
        requests.push(
          page.request.get('/api/users', {
            headers: { Authorization: `Bearer ${key}` },
          })
        )
      }

      const responses = await Promise.all(requests)

      // THEN: Exactly 5 succeed, 5 are rate limited
      const successCount = responses.filter((r) => r.status() === 200).length
      const rateLimitedCount = responses.filter((r) => r.status() === 429).length

      expect(successCount).toBe(5)
      expect(rateLimitedCount).toBe(5)
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-RATE-LIMIT-007: system can enforce rate limits across multiple keys',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Server with rate limiting for multiple keys
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: {
              rateLimit: {
                requestsPerMinute: 18, // 3 per 10 seconds = 18 per minute
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

      // Create two API keys
      const key1Response = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Key 1',
        },
      })
      const { key: key1 } = await key1Response.json()

      const key2Response = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Key 2',
        },
      })
      const { key: key2 } = await key2Response.json()

      // WHEN/THEN: Key 1 can make 3 requests
      for (let i = 0; i < 3; i++) {
        const response = await page.request.get('/api/users', {
          headers: { Authorization: `Bearer ${key1}` },
        })
        expect(response.status()).toBe(200)
      }

      const key1Response4 = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${key1}` },
      })
      expect(key1Response4.status()).toBe(429)

      // WHEN/THEN: Key 2 has independent rate limit
      for (let i = 0; i < 3; i++) {
        const response = await page.request.get('/api/users', {
          headers: { Authorization: `Bearer ${key2}` },
        })
        expect(response.status()).toBe(200)
      }

      const key2Response4 = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${key2}` },
      })
      expect(key2Response4.status()).toBe(429)
    }
  )
})
