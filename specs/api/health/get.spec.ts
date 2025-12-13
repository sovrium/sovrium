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
 * Spec Count: 1
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

/**
 * Test Case 1: Health endpoint returns 200 OK
 *
 * GIVEN: A running server
 * WHEN: User requests GET /api/health
 * THEN: Response should be 200 OK with JSON content-type
 */
// API-HEALTH-001: User requests health endpoint
test(
  'API-HEALTH-001: should return 200 OK status and proper JSON structure',
  { tag: '@regression' },
  async ({ page, startServerWithSchema }) => {
    await test.step('Setup: Start server with app name', async () => {
      await startServerWithSchema({
        name: 'health-test-app',
      })
    })

    await test.step('Request health endpoint and verify response', async () => {
      const response = await page.goto('/api/health')

      expect(response?.status()).toBe(200)

      const contentType = response?.headers()['content-type']
      expect(contentType).toContain('application/json')
    })
  }
)

/**
 * Test Case 2: Health endpoint returns proper JSON structure
 *
 * GIVEN: A server with app name "monitoring-app"
 * WHEN: User requests GET /api/health
 * THEN: JSON should contain status, timestamp, and app object
 */
// API-HEALTH-002: User requests health endpoint
test(
  'API-HEALTH-002: should return JSON with status, timestamp, and app name',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: A server with specific app name
    await startServerWithSchema({
      name: 'monitoring-app',
    })

    // WHEN: User requests health endpoint
    const response = await page.goto('/api/health')
    const json = await response?.json()

    // THEN: JSON should have status field
    expect(json).toHaveProperty('status', 'ok')

    // AND: JSON should have timestamp field (ISO 8601 format)
    // THEN: assertion
    expect(json).toHaveProperty('timestamp')
    expect(json.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)

    // AND: JSON should have app object with name
    // THEN: assertion
    expect(json).toHaveProperty('app')
    expect(json.app).toHaveProperty('name', 'monitoring-app')
  }
)

/**
 * Test Case 3: Health endpoint timestamp is current
 *
 * GIVEN: A running server
 * WHEN: User requests GET /api/health
 * THEN: Timestamp should be within last 5 seconds
 */
// API-HEALTH-003: User requests health endpoint
test(
  'API-HEALTH-003: should return current timestamp',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: A running server
    await startServerWithSchema({
      name: 'timestamp-test',
    })

    // WHEN: User requests health endpoint
    const beforeRequest = new Date()
    const response = await page.goto('/api/health')
    const afterRequest = new Date()
    const json = await response?.json()

    // THEN: Timestamp should be between request start and end
    const timestamp = new Date(json.timestamp)
    expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime() - 1000)
    expect(timestamp.getTime()).toBeLessThanOrEqual(afterRequest.getTime() + 1000)
  }
)

/**
 * Test Case 4: Health endpoint works with scoped package names
 *
 * GIVEN: A server with scoped app name "@myorg/dashboard"
 * WHEN: User requests GET /api/health
 * THEN: App name should preserve @ and / characters
 */
// API-HEALTH-004: User requests health endpoint
test(
  'API-HEALTH-004: should handle scoped package names in health response',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: A server with scoped package name
    await startServerWithSchema({
      name: '@myorg/dashboard',
    })

    // WHEN: User requests health endpoint
    const response = await page.goto('/api/health')
    const json = await response?.json()

    // THEN: App name should preserve special characters
    expect(json.app.name).toBe('@myorg/dashboard')
  }
)
