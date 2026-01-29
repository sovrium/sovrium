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
 * Source: src/infrastructure/server/server.ts
 * Domain: api
 * Spec Count: 0
 *
 * Health Endpoint Behavior:
 * - Returns JSON with status, timestamp, app name
 * - Must return 200 OK status
 * - Critical for load balancer health checks
 * - Used by monitoring and deployment verification
 *
 * Test Organization:
 * 1. @regression test - ONE comprehensive test (health endpoint is simple)
 */

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
