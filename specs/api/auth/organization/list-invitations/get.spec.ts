/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for List organization invitations
 *
 * Source: specs/api/paths/auth/organization/list-invitations/get.json
 * Domain: api
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (8 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation via API (no direct executeQuery for auth data)
 * - Authentication/authorization checks via auth fixtures
 */

test.describe('List organization invitations', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-LIST-INVITATIONS-001: should return 200 OK with all invitations',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated organization owner and multiple invitations
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

      // Create multiple invitations
      await page.request.post('/api/auth/organization/invite-member', {
        data: { organizationId: org.id, email: 'pending@example.com', role: 'member' },
      })
      await page.request.post('/api/auth/organization/invite-member', {
        data: { organizationId: org.id, email: 'admin@example.com', role: 'admin' },
      })

      // WHEN: Owner requests list of all invitations
      const response = await page.request.get(
        `/api/auth/organization/list-invitations?organizationId=${org.id}`
      )

      // THEN: Returns 200 OK with all invitations
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('invitations')
      expect(Array.isArray(data.invitations)).toBe(true)
    }
  )

  test.fixme(
    'API-AUTH-ORG-LIST-INVITATIONS-002: should return 200 OK with filtered pending invitations',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated organization owner and multiple invitations
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

      // Create invitations
      await page.request.post('/api/auth/organization/invite-member', {
        data: { organizationId: org.id, email: 'pending1@example.com', role: 'member' },
      })
      await page.request.post('/api/auth/organization/invite-member', {
        data: { organizationId: org.id, email: 'pending2@example.com', role: 'admin' },
      })

      // WHEN: Owner requests list filtered by pending status
      const response = await page.request.get(
        `/api/auth/organization/list-invitations?organizationId=${org.id}&status=pending`
      )

      // THEN: Returns 200 OK with only pending invitations
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('invitations')
    }
  )

  test.fixme(
    'API-AUTH-ORG-LIST-INVITATIONS-003: should return 400 Bad Request without organizationId',
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

      // WHEN: User requests invitations without organizationId parameter
      const response = await page.request.get('/api/auth/organization/list-invitations')

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-LIST-INVITATIONS-004: should return 401 Unauthorized',
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

      // WHEN: Unauthenticated user attempts to list invitations
      const response = await page.request.get(
        '/api/auth/organization/list-invitations?organizationId=1'
      )

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ORG-LIST-INVITATIONS-005: should return 403 Forbidden for regular member',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated regular member (not owner/admin)
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

      await page.request.post('/api/auth/organization/add-member', {
        data: { organizationId: org.id, userId: '2', role: 'member' },
      })

      // Sign in as member
      await signIn({
        email: 'member@example.com',
        password: 'MemberPass123!',
      })

      // WHEN: Member attempts to list invitations
      const response = await page.request.get(
        `/api/auth/organization/list-invitations?organizationId=${org.id}`
      )

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-LIST-INVITATIONS-006: should return 404 Not Found for non-existent organization',
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

      // WHEN: User requests invitations for non-existent organization
      const response = await page.request.get(
        '/api/auth/organization/list-invitations?organizationId=nonexistent-id'
      )

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-LIST-INVITATIONS-007: should return 404 Not Found for different organization (prevent enumeration)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated owner of one organization
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      // Owner 1 creates organization 1
      await signUp({
        email: 'owner1@example.com',
        password: 'Owner1Pass123!',
        name: 'Owner 1',
      })

      await page.request.post('/api/auth/organization/create', {
        data: { name: 'Org One', slug: 'org-one' },
      })

      // Owner 2 creates organization 2
      await signUp({
        email: 'owner2@example.com',
        password: 'Owner2Pass123!',
        name: 'Owner 2',
      })

      const createResponse2 = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Org Two', slug: 'org-two' },
      })
      const org2 = await createResponse2.json()

      // Sign back in as Owner 1
      await signIn({
        email: 'owner1@example.com',
        password: 'Owner1Pass123!',
      })

      // WHEN: Owner 1 attempts to list invitations from Organization 2
      const response = await page.request.get(
        `/api/auth/organization/list-invitations?organizationId=${org2.id}`
      )

      // THEN: Returns 404 Not Found (prevent enumeration)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-LIST-INVITATIONS-008: should return 200 OK with empty invitations array',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated organization owner with no invitations
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

      // WHEN: Owner requests list of invitations
      const response = await page.request.get(
        `/api/auth/organization/list-invitations?organizationId=${org.id}`
      )

      // THEN: Returns 200 OK with empty invitations array
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('invitations')
      expect(data.invitations).toHaveLength(0)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-LIST-INVITATIONS-009: user can complete full listInvitations workflow',
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
        '/api/auth/organization/list-invitations?organizationId=1'
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

      // Test 2: List empty invitations succeeds
      const emptyResponse = await page.request.get(
        `/api/auth/organization/list-invitations?organizationId=${org.id}`
      )
      expect(emptyResponse.status()).toBe(200)

      // Add invitation
      await page.request.post('/api/auth/organization/invite-member', {
        data: { organizationId: org.id, email: 'invitee@example.com', role: 'member' },
      })

      // Test 3: List with invitations succeeds
      const listResponse = await page.request.get(
        `/api/auth/organization/list-invitations?organizationId=${org.id}`
      )
      expect(listResponse.status()).toBe(200)

      const data = await listResponse.json()
      expect(data.invitations.length).toBeGreaterThan(0)
    }
  )
})
