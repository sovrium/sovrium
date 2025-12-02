/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable drizzle/enforce-delete-with-where */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Remove member from organization
 *
 * Source: specs/api/paths/auth/organization/remove-member/delete.json
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

test.describe('Remove member from organization', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-REMOVE-MEMBER-001: should return 200 OK and member is removed',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization owner and an existing member
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { organization: true },
        },
      })

      // Create owner and sign in
      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })
      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      // Create organization
      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      // Create member user
      await signUp({
        email: 'member@example.com',
        password: 'MemberPass123!',
        name: 'Member User',
      })

      // Sign back in as owner and add member
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

      // WHEN: Owner removes member from organization
      const response = await page.request.delete('/api/auth/organization/remove-member', {
        data: {
          organizationId: org.id,
          userId: '2',
        },
      })

      // THEN: Returns 200 OK and member is removed
      expect(response.status()).toBe(200)

      // Verify member is no longer in organization
      const membersResponse = await page.request.get(
        `/api/auth/organization/list-members?organizationId=${org.id}`
      )
      const members = await membersResponse.json()
      const removedMember = members.members?.find((m: { userId: string }) => m.userId === '2')
      expect(removedMember).toBeUndefined()
    }
  )

  test.fixme(
    'API-AUTH-ORG-REMOVE-MEMBER-002: should return 400 Bad Request with validation errors',
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
      const response = await page.request.delete('/api/auth/organization/remove-member', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation errors
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-REMOVE-MEMBER-003: should return 401 Unauthorized',
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

      // WHEN: Unauthenticated user attempts to remove member
      const response = await page.request.delete('/api/auth/organization/remove-member', {
        data: {
          organizationId: '1',
          userId: '2',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ORG-REMOVE-MEMBER-004: should return 403 Forbidden',
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

      // Create two members
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

      // Owner adds both members
      await page.request.post('/api/auth/organization/add-member', {
        data: { organizationId: org.id, userId: '2', role: 'member' },
      })
      await page.request.post('/api/auth/organization/add-member', {
        data: { organizationId: org.id, userId: '3', role: 'member' },
      })

      // Sign in as member1
      await signIn({
        email: 'member1@example.com',
        password: 'Member1Pass123!',
      })

      // WHEN: Member attempts to remove another member
      const response = await page.request.delete('/api/auth/organization/remove-member', {
        data: {
          organizationId: org.id,
          userId: '3',
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-REMOVE-MEMBER-005: should return 404 Not Found',
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

      // WHEN: Owner attempts to remove non-existent member
      const response = await page.request.delete('/api/auth/organization/remove-member', {
        data: {
          organizationId: org.id,
          userId: 'nonexistent-user-id',
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-REMOVE-MEMBER-006: should return 403 Forbidden to prevent ownerless organization',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization owner who is the only owner
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

      // WHEN: Owner attempts to remove themselves (last owner)
      const response = await page.request.delete('/api/auth/organization/remove-member', {
        data: {
          organizationId: org.id,
          userId: '1',
        },
      })

      // THEN: Returns 403 Forbidden to prevent ownerless organization
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-REMOVE-MEMBER-007: should return 200 OK when member removes themselves',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization member (non-owner)
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

      // Create member
      await signUp({
        email: 'member@example.com',
        password: 'MemberPass123!',
        name: 'Member User',
      })

      // Owner adds member
      await page.request.post('/api/auth/organization/add-member', {
        data: { organizationId: org.id, userId: '2', role: 'member' },
      })

      // Sign in as member
      await signIn({
        email: 'member@example.com',
        password: 'MemberPass123!',
      })

      // WHEN: Non-owner member removes themselves from organization
      const response = await page.request.delete('/api/auth/organization/remove-member', {
        data: {
          organizationId: org.id,
          userId: '2',
        },
      })

      // THEN: Returns 200 OK and member is removed
      expect(response.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-ORG-REMOVE-MEMBER-008: should return 404 Not Found (prevent organization enumeration)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization owner and a member from different organization
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { organization: true },
        },
      })

      // Owner 1 creates organization 1
      await signUp({
        email: 'owner1@example.com',
        password: 'Owner1Pass123!',
        name: 'Owner 1',
      })
      await signIn({
        email: 'owner1@example.com',
        password: 'Owner1Pass123!',
      })

      await page.request.post('/api/auth/organization/create', {
        data: { name: 'Org One', slug: 'org-one' },
      })

      // Owner 2 creates organization 2 with a member
      await signUp({
        email: 'owner2@example.com',
        password: 'Owner2Pass123!',
        name: 'Owner 2',
      })
      await signIn({
        email: 'owner2@example.com',
        password: 'Owner2Pass123!',
      })

      const createResponse2 = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Org Two', slug: 'org-two' },
      })
      const org2 = await createResponse2.json()

      // Create member for org 2
      await signUp({
        email: 'member@example.com',
        password: 'MemberPass123!',
        name: 'Member User',
      })

      await page.request.post('/api/auth/organization/add-member', {
        data: { organizationId: org2.id, userId: '3', role: 'member' },
      })

      // Sign back in as Owner 1
      await signIn({
        email: 'owner1@example.com',
        password: 'Owner1Pass123!',
      })

      // WHEN: Owner 1 attempts to remove member from Organization 2
      const response = await page.request.delete('/api/auth/organization/remove-member', {
        data: {
          organizationId: org2.id,
          userId: '3',
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
    'API-AUTH-ORG-REMOVE-MEMBER-009: user can complete full removeMember workflow',
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

      // Test 1: Remove member without auth fails
      const noAuthResponse = await page.request.delete('/api/auth/organization/remove-member', {
        data: { organizationId: '1', userId: '2' },
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

      // Create and add member
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

      // Test 2: Remove member succeeds for owner
      const removeResponse = await page.request.delete('/api/auth/organization/remove-member', {
        data: { organizationId: org.id, userId: '2' },
      })
      expect(removeResponse.status()).toBe(200)

      // Test 3: Removing non-existent member fails
      const notFoundResponse = await page.request.delete('/api/auth/organization/remove-member', {
        data: { organizationId: org.id, userId: '999' },
      })
      expect(notFoundResponse.status()).toBe(404)
    }
  )
})
