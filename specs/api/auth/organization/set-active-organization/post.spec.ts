/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Set active organization
 *
 * Source: specs/api/paths/auth/organization/set-active-organization/post.json
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

test.describe('Set active organization', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-SET-ACTIVE-ORGANIZATION-001: should return 200 OK and update session',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user who is member of multiple organizations
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      // Create user and sign in
      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })

      // Create first organization
      await page.request.post('/api/auth/organization/create', {
        data: { name: 'Org One', slug: 'org-one' },
      })

      // Create second organization
      const createResponse2 = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Org Two', slug: 'org-two' },
      })
      const org2 = await createResponse2.json()

      // WHEN: User sets active organization
      const response = await page.request.post('/api/auth/organization/set-active', {
        data: {
          organizationId: org2.id,
        },
      })

      // THEN: Returns 200 OK and updates session with active organization
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('session')
    }
  )

  test.fixme(
    'API-AUTH-ORG-SET-ACTIVE-ORGANIZATION-002: should return 400 Bad Request with validation error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
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

      // WHEN: User submits request without organizationId
      const response = await page.request.post('/api/auth/organization/set-active', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-SET-ACTIVE-ORGANIZATION-003: should return 401 Unauthorized',
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

      // WHEN: Unauthenticated user attempts to set active organization
      const response = await page.request.post('/api/auth/organization/set-active', {
        data: {
          organizationId: '1',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ORG-SET-ACTIVE-ORGANIZATION-004: should return 404 Not Found',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
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

      // WHEN: User attempts to set non-existent organization as active
      const response = await page.request.post('/api/auth/organization/set-active', {
        data: {
          organizationId: 'nonexistent-org-id',
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-SET-ACTIVE-ORGANIZATION-005: should return 404 Not Found (prevent enumeration)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user who is not member of an organization
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      // Create first user
      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })

      // Create owner and their private organization
      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })
      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Private Org', slug: 'private-org' },
      })
      const privateOrg = await createResponse.json()

      // Sign in as regular user (not member of private org)
      await signIn({
        email: 'user@example.com',
        password: 'UserPass123!',
      })

      // WHEN: User attempts to set that organization as active
      const response = await page.request.post('/api/auth/organization/set-active', {
        data: {
          organizationId: privateOrg.id,
        },
      })

      // THEN: Returns 404 Not Found (prevent organization enumeration)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-SET-ACTIVE-ORGANIZATION-006: user can complete full setActiveOrganization workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      // Test 1: Set active organization without auth fails
      const noAuthResponse = await page.request.post('/api/auth/organization/set-active', {
        data: { organizationId: '1' },
      })
      expect(noAuthResponse.status()).toBe(401)

      // Create user and sign in
      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })

      // Create two organizations
      const createResponse1 = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Org One', slug: 'org-one' },
      })
      const org1 = await createResponse1.json()

      const createResponse2 = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Org Two', slug: 'org-two' },
      })
      const org2 = await createResponse2.json()

      // Test 2: Set active organization succeeds
      const setActiveResponse = await page.request.post('/api/auth/organization/set-active', {
        data: { organizationId: org2.id },
      })
      expect(setActiveResponse.status()).toBe(200)

      // Test 3: Switch back to first organization
      const switchResponse = await page.request.post('/api/auth/organization/set-active', {
        data: { organizationId: org1.id },
      })
      expect(switchResponse.status()).toBe(200)

      // Test 4: Set non-member organization fails
      const notFoundResponse = await page.request.post('/api/auth/organization/set-active', {
        data: { organizationId: 'nonexistent-id' },
      })
      expect(notFoundResponse.status()).toBe(404)
    }
  )
})
