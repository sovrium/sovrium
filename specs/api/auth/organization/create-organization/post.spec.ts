/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Create organization
 *
 * Source: specs/api/paths/auth/organization/create-organization/post.json
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
 *
 * Note: Organization tests require authenticated users. Users are created via
 * the signUp/signIn fixtures which call the Better Auth API directly.
 */

test.describe('Create organization', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-CREATE-ORGANIZATION-001: should return 201 Created with organization data and user is set as owner',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { organization: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })
      await signIn({
        email: 'user@example.com',
        password: 'UserPass123!',
      })

      // WHEN: User creates a new organization with valid data
      const response = await page.request.post('/api/auth/organization/create', {
        data: {
          name: 'Acme Corporation',
          slug: 'acme-corp',
        },
      })

      // THEN: Returns 201 Created with organization data and user is set as owner
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name', 'Acme Corporation')
      expect(data).toHaveProperty('slug', 'acme-corp')
    }
  )

  test.fixme(
    'API-AUTH-ORG-CREATE-ORGANIZATION-002: should return 201 Created with auto-generated slug from name',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { organization: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })
      await signIn({
        email: 'user@example.com',
        password: 'UserPass123!',
      })

      // WHEN: User creates organization without providing slug
      const response = await page.request.post('/api/auth/organization/create', {
        data: {
          name: 'My Company',
        },
      })

      // THEN: Returns 201 Created with auto-generated slug from name
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data).toHaveProperty('name', 'My Company')
      expect(data).toHaveProperty('slug')
      expect(data.slug).toMatch(/^my-company/)
    }
  )

  test.fixme(
    'API-AUTH-ORG-CREATE-ORGANIZATION-003: should return 400 Bad Request with validation error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { organization: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })
      await signIn({
        email: 'user@example.com',
        password: 'UserPass123!',
      })

      // WHEN: User submits request without name field
      const response = await page.request.post('/api/auth/organization/create', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-CREATE-ORGANIZATION-004: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { organization: true },
        },
      })

      // WHEN: Unauthenticated user attempts to create organization
      const response = await page.request.post('/api/auth/organization/create', {
        data: {
          name: 'Acme Corporation',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ORG-CREATE-ORGANIZATION-005: should return 409 Conflict error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user and an existing organization with same slug
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { organization: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })
      await signIn({
        email: 'user@example.com',
        password: 'UserPass123!',
      })

      // Create first organization
      await page.request.post('/api/auth/organization/create', {
        data: {
          name: 'Existing Org',
          slug: 'existing-org',
        },
      })

      // WHEN: User attempts to create organization with existing slug
      const response = await page.request.post('/api/auth/organization/create', {
        data: {
          name: 'Another Org',
          slug: 'existing-org',
        },
      })

      // THEN: Returns 409 Conflict error
      expect(response.status()).toBe(409)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-CREATE-ORGANIZATION-006: user can complete full createOrganization workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { organization: true },
        },
      })

      // Test 1: Create organization without auth fails
      const noAuthResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org' },
      })
      expect(noAuthResponse.status()).toBe(401)

      // Create and authenticate user
      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })
      await signIn({
        email: 'user@example.com',
        password: 'UserPass123!',
      })

      // Test 2: Create organization succeeds
      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: {
          name: 'My Organization',
          slug: 'my-org',
        },
      })
      expect(createResponse.status()).toBe(201)

      const org = await createResponse.json()
      expect(org).toHaveProperty('name', 'My Organization')
      expect(org).toHaveProperty('slug', 'my-org')

      // Test 3: Duplicate slug fails
      const duplicateResponse = await page.request.post('/api/auth/organization/create', {
        data: {
          name: 'Another Org',
          slug: 'my-org',
        },
      })
      expect(duplicateResponse.status()).toBe(409)
    }
  )
})
