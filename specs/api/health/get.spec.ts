/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for GET /api/health
 *
 * Source: src/infrastructure/server/route-setup/api-routes.ts
 * Schema: src/domain/models/api/health-schemas.ts
 * Domain: api
 * Spec Count: 3
 *
 * Health Endpoint Behavior:
 * - Returns JSON with status, timestamp, app name
 * - Response shape: { status: 'ok', timestamp: '<ISO 8601>', app: { name: '<name>' } }
 * - Must return 200 OK status with application/json content type
 * - Does not require authentication (registered before auth middleware)
 * - Critical for load balancer health checks
 * - Used by monitoring and deployment verification
 *
 * Test Organization:
 * 1. @spec tests - One per valid acceptance criterion (3 tests)
 * 2. @regression test - ONE comprehensive test (all behaviors)
 */

test.describe('GET /api/health', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of valid acceptance criteria
  // ============================================================================

  test(
    'API-HEALTH-001: should return 200 OK with status ok and correct JSON structure',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application server is running with a configured app name
      await startServerWithSchema({
        name: 'health-spec-app',
      })

      // WHEN: Client sends GET request to /api/health
      const response = await page.goto('/api/health')

      // THEN: Response status is 200
      expect(response?.status()).toBe(200)

      // THEN: Response content type is JSON
      const contentType = response?.headers()['content-type']
      expect(contentType).toContain('application/json')

      // THEN: Response body contains status 'ok'
      const json = await response?.json()
      expect(json).toHaveProperty('status', 'ok')

      // THEN: Response body contains app object with name matching schema
      expect(json).toHaveProperty('app')
      expect(json.app).toHaveProperty('name', 'health-spec-app')
    }
  )

  test(
    'API-HEALTH-002: should include current ISO 8601 timestamp in response',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application server is running
      await startServerWithSchema({
        name: 'timestamp-test-app',
      })

      // WHEN: Client sends GET request to /api/health
      const beforeRequest = new Date()
      const response = await page.goto('/api/health')
      const afterRequest = new Date()

      // THEN: Response contains a timestamp field
      const json = await response?.json()
      expect(json).toHaveProperty('timestamp')

      // THEN: Timestamp is in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
      expect(json.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)

      // THEN: Timestamp represents the current time (within reasonable tolerance)
      const timestamp = new Date(json.timestamp)
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime() - 1000)
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterRequest.getTime() + 1000)
    }
  )

  test(
    'API-HEALTH-003: should not require authentication to access',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with authentication enabled (protected routes exist)
      await startServerWithSchema({
        name: 'auth-health-test-app',
        auth: { emailAndPassword: true },
      })

      // WHEN: Unauthenticated client sends GET request to /api/health
      // (no sign-in, no cookies, no auth headers)
      const response = await page.goto('/api/health')

      // THEN: Response is 200 OK (not 401 or 403)
      expect(response?.status()).toBe(200)

      // THEN: Response contains valid health data
      const json = await response?.json()
      expect(json).toHaveProperty('status', 'ok')
      expect(json).toHaveProperty('timestamp')
      expect(json).toHaveProperty('app')
      expect(json.app).toHaveProperty('name', 'auth-health-test-app')
    }
  )

  // ============================================================================
  // @regression test - ONE comprehensive test covering all behaviors
  // ============================================================================

  test(
    'API-HEALTH-REGRESSION: health endpoint returns complete status information',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await test.step('1: Start server with app name', async () => {
        await startServerWithSchema({
          name: 'health-test-app',
        })
      })

      await test.step('2: Returns 200 OK with JSON content type', async () => {
        const response = await page.goto('/api/health')

        expect(response?.status()).toBe(200)

        const contentType = response?.headers()['content-type']
        expect(contentType).toContain('application/json')
      })

      await test.step('3: JSON structure has status, timestamp, and app name', async () => {
        const response = await page.goto('/api/health')
        const json = await response?.json()

        // Status field
        expect(json).toHaveProperty('status', 'ok')

        // Timestamp field (ISO 8601 format)
        expect(json).toHaveProperty('timestamp')
        expect(json.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)

        // App name
        expect(json).toHaveProperty('app')
        expect(json.app).toHaveProperty('name', 'health-test-app')
      })

      await test.step('4: Timestamp is current', async () => {
        const beforeRequest = new Date()
        const response = await page.goto('/api/health')
        const afterRequest = new Date()
        const json = await response?.json()

        const timestamp = new Date(json.timestamp)
        expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime() - 1000)
        expect(timestamp.getTime()).toBeLessThanOrEqual(afterRequest.getTime() + 1000)
      })

      await test.step('5: Handles scoped package names', async () => {
        await startServerWithSchema({
          name: '@myorg/dashboard',
        })

        const response = await page.goto('/api/health')
        const json = await response?.json()

        expect(json.app.name).toBe('@myorg/dashboard')
      })
    }
  )
})
