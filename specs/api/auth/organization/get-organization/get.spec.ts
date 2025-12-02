/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Get organization details
 *
 * Source: specs/api/paths/auth/organization/get-organization/get.json
 * Domain: api
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation via API (no direct executeQuery for auth data)
 * - Authentication/authorization checks via auth fixtures
 */

test.describe('Get organization details', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-GET-ORGANIZATION-001: should return 200 OK with organization data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated user who is member of an organization
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })

      // Create organization (user becomes owner)
      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      // WHEN: User requests organization details
      const response = await page.request.get(
        `/api/auth/organization/get-full-organization?organizationId=${org.id}`
      )

      // THEN: Returns 200 OK with organization data
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('id', org.id)
      expect(data).toHaveProperty('name', 'Test Org')
      expect(data).toHaveProperty('slug', 'test-org')
    }
  )

  test.fixme(
    'API-AUTH-ORG-GET-ORGANIZATION-002: should return 400 Bad Request with validation error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })

      // WHEN: User requests organization without organizationId parameter
      const response = await page.request.get('/api/auth/organization/get-full-organization')

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-GET-ORGANIZATION-003: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      // WHEN: Unauthenticated user attempts to get organization
      const response = await page.request.get(
        '/api/auth/organization/get-full-organization?organizationId=1'
      )

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ORG-GET-ORGANIZATION-004: should return 404 Not Found',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })

      // WHEN: User requests non-existent organization
      const response = await page.request.get(
        '/api/auth/organization/get-full-organization?organizationId=nonexistent-id'
      )

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-GET-ORGANIZATION-005: should return 404 Not Found (not 403 to prevent organization enumeration)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated user who is not member of an organization
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      // Create owner user and organization
      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Private Org', slug: 'private-org' },
      })
      const org = await createResponse.json()

      // Create and sign in as different user
      await signUp({
        email: 'other@example.com',
        password: 'OtherPass123!',
        name: 'Other User',
      })

      // WHEN: User attempts to get organization details
      const response = await page.request.get(
        `/api/auth/organization/get-full-organization?organizationId=${org.id}`
      )

      // THEN: Returns 404 Not Found (not 403 to prevent organization enumeration)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-GET-ORGANIZATION-006: user can complete full getOrganization workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      // Test 1: Get organization without auth fails
      const noAuthResponse = await page.request.get(
        '/api/auth/organization/get-full-organization?organizationId=1'
      )
      expect(noAuthResponse.status()).toBe(401)

      // Create and authenticate user
      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })

      // Create organization
      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      // Test 2: Get own organization succeeds
      const getResponse = await page.request.get(
        `/api/auth/organization/get-full-organization?organizationId=${org.id}`
      )
      expect(getResponse.status()).toBe(200)

      const data = await getResponse.json()
      expect(data).toHaveProperty('name', 'Test Org')

      // Test 3: Get non-existent organization fails
      const notFoundResponse = await page.request.get(
        '/api/auth/organization/get-full-organization?organizationId=nonexistent-id'
      )
      expect(notFoundResponse.status()).toBe(404)
    }
  )
})
