/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Add member to organization
 *
 * Source: specs/api/paths/auth/organization/add-member/post.json
 * Domain: api
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (6 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation via API (no direct executeQuery for auth data)
 * - Authentication/authorization checks via auth fixtures
 *
 * Note: Add member directly adds a user without invitation flow (admin feature)
 */

test.describe('Add member to organization', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-ADD-MEMBER-001: should return 201 Created with member data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization owner and an existing user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { organization: true },
        },
      })

      // Create owner and organization
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
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      // Create user to be added
      await signUp({
        email: 'newmember@example.com',
        password: 'MemberPass123!',
        name: 'New Member',
      })

      // Sign back in as owner
      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      // WHEN: Owner adds new member
      const response = await page.request.post('/api/auth/organization/add-member', {
        data: {
          organizationId: org.id,
          userId: '2', // second user created
          role: 'member',
        },
      })

      // THEN: Returns 201 Created with member data
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data).toHaveProperty('member')
    }
  )

  test.fixme(
    'API-AUTH-ORG-ADD-MEMBER-002: should return 400 Bad Request with validation errors',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { organization: true },
        },
      })

      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })
      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })

      // WHEN: Owner submits request without required fields
      const response = await page.request.post('/api/auth/organization/add-member', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation errors
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-ADD-MEMBER-003: should return 401 Unauthorized',
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

      // WHEN: Unauthenticated user attempts to add member
      const response = await page.request.post('/api/auth/organization/add-member', {
        data: {
          organizationId: '1',
          userId: '2',
          role: 'member',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ORG-ADD-MEMBER-004: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated regular member (not owner/admin)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { organization: true },
        },
      })

      // Owner creates organization
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
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      // Create member and add them
      await signUp({
        email: 'member@example.com',
        password: 'MemberPass123!',
        name: 'Member User',
      })

      await page.request.post('/api/auth/organization/add-member', {
        data: {
          organizationId: org.id,
          userId: '2',
          role: 'member',
        },
      })

      // Create third user to try to add
      await signUp({
        email: 'third@example.com',
        password: 'ThirdPass123!',
        name: 'Third User',
      })

      // Sign in as member
      await signIn({
        email: 'member@example.com',
        password: 'MemberPass123!',
      })

      // WHEN: Member attempts to add another user
      const response = await page.request.post('/api/auth/organization/add-member', {
        data: {
          organizationId: org.id,
          userId: '3',
          role: 'member',
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-ADD-MEMBER-005: should return 404 Not Found',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { organization: true },
        },
      })

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
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      // WHEN: Owner attempts to add non-existent user
      const response = await page.request.post('/api/auth/organization/add-member', {
        data: {
          organizationId: org.id,
          userId: 'nonexistent-user-id',
          role: 'member',
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-ADD-MEMBER-006: should return 409 Conflict error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization owner and a user who is already member
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { organization: true },
        },
      })

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
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      // Create and add member
      await signUp({
        email: 'member@example.com',
        password: 'MemberPass123!',
        name: 'Member User',
      })

      // Sign back in as owner
      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      await page.request.post('/api/auth/organization/add-member', {
        data: {
          organizationId: org.id,
          userId: '2',
          role: 'member',
        },
      })

      // WHEN: Owner attempts to add same user again
      const response = await page.request.post('/api/auth/organization/add-member', {
        data: {
          organizationId: org.id,
          userId: '2',
          role: 'member',
        },
      })

      // THEN: Returns 409 Conflict
      expect(response.status()).toBe(409)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-ADD-MEMBER-007: user can complete full addMember workflow',
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

      // Test 1: Add member without auth fails
      const noAuthResponse = await page.request.post('/api/auth/organization/add-member', {
        data: { organizationId: '1', userId: '2', role: 'member' },
      })
      expect(noAuthResponse.status()).toBe(401)

      // Create owner and organization
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
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      // Create user to add
      await signUp({
        email: 'newmember@example.com',
        password: 'MemberPass123!',
        name: 'New Member',
      })

      // Sign back in as owner
      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      // Test 2: Add member succeeds for owner
      const addResponse = await page.request.post('/api/auth/organization/add-member', {
        data: {
          organizationId: org.id,
          userId: '2',
          role: 'member',
        },
      })
      expect(addResponse.status()).toBe(201)

      // Test 3: Adding same user again fails
      const duplicateResponse = await page.request.post('/api/auth/organization/add-member', {
        data: {
          organizationId: org.id,
          userId: '2',
          role: 'member',
        },
      })
      expect(duplicateResponse.status()).toBe(409)
    }
  )
})
