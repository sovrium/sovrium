/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for List organization members
 *
 * Source: specs/api/paths/auth/organization/list-members/get.json
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
 */

test.describe('List organization members', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-LIST-MEMBERS-001: should return 200 OK with all members and their roles',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user who is member of organization with multiple members
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      // Add members
      await signUp({
        email: 'member1@example.com',
        password: 'Member1Pass123!',
        name: 'Member 1',
      })
      await signUp({
        email: 'member2@example.com',
        password: 'Member2Pass123!',
        name: 'Member 2',
      })

      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      await page.request.post('/api/auth/organization/add-member', {
        data: { organizationId: org.id, userId: '2', role: 'member' },
      })
      await page.request.post('/api/auth/organization/add-member', {
        data: { organizationId: org.id, userId: '3', role: 'admin' },
      })

      // WHEN: Owner requests list of organization members
      const response = await page.request.get(
        `/api/auth/organization/list-members?organizationId=${org.id}`
      )

      // THEN: Returns 200 OK with all members and their roles
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('members')
      expect(Array.isArray(data.members)).toBe(true)
    }
  )

  test.fixme(
    'API-AUTH-ORG-LIST-MEMBERS-002: should return 400 Bad Request without organizationId',
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

      // WHEN: User requests members without organizationId parameter
      const response = await page.request.get('/api/auth/organization/list-members')

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-LIST-MEMBERS-003: should return 401 Unauthorized',
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

      // WHEN: Unauthenticated user attempts to list members
      const response = await page.request.get(
        '/api/auth/organization/list-members?organizationId=1'
      )

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ORG-LIST-MEMBERS-004: should return 404 Not Found for non-existent organization',
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

      // WHEN: User requests members of non-existent organization
      const response = await page.request.get(
        '/api/auth/organization/list-members?organizationId=nonexistent-id'
      )

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-LIST-MEMBERS-005: should return 404 Not Found for non-member (prevent enumeration)',
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

      // Owner creates organization
      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Private Org', slug: 'private-org' },
      })
      const org = await createResponse.json()

      // Create non-member user
      await signUp({
        email: 'nonmember@example.com',
        password: 'NonMemberPass123!',
        name: 'Non Member',
      })

      // WHEN: Non-member attempts to list organization members
      const response = await page.request.get(
        `/api/auth/organization/list-members?organizationId=${org.id}`
      )

      // THEN: Returns 404 Not Found (prevent enumeration)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-LIST-MEMBERS-006: should return 200 OK with member data excluding password',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization member
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      await signUp({
        email: 'member@example.com',
        password: 'MemberPass123!',
        name: 'Member User',
      })

      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      await page.request.post('/api/auth/organization/add-member', {
        data: { organizationId: org.id, userId: '2', role: 'member' },
      })

      // WHEN: User requests list of members
      const response = await page.request.get(
        `/api/auth/organization/list-members?organizationId=${org.id}`
      )

      // THEN: Returns 200 OK with member data but password excluded
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('members')

      // Verify password is not included in response
      if (data.members.length > 0) {
        expect(data.members[0]).not.toHaveProperty('password')
        expect(data.members[0]).not.toHaveProperty('passwordHash')
        expect(data.members[0]).not.toHaveProperty('password_hash')
      }
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-LIST-MEMBERS-007: user can complete full listMembers workflow',
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

      // Test 1: List without auth fails
      const noAuthResponse = await page.request.get(
        '/api/auth/organization/list-members?organizationId=1'
      )
      expect(noAuthResponse.status()).toBe(401)

      // Create owner and organization
      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      // Test 2: List members succeeds (owner is member)
      const listResponse = await page.request.get(
        `/api/auth/organization/list-members?organizationId=${org.id}`
      )
      expect(listResponse.status()).toBe(200)

      const data = await listResponse.json()
      expect(data.members.length).toBeGreaterThan(0)

      // Test 3: Non-member gets 404
      await signUp({
        email: 'outsider@example.com',
        password: 'OutsiderPass123!',
        name: 'Outsider',
      })

      const outsiderResponse = await page.request.get(
        `/api/auth/organization/list-members?organizationId=${org.id}`
      )
      expect(outsiderResponse.status()).toBe(404)
    }
  )
})
