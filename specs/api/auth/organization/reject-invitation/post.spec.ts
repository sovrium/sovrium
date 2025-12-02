/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Reject organization invitation
 *
 * Source: specs/api/paths/auth/organization/reject-invitation/post.json
 * Domain: api
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (7 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation via API (no direct executeQuery for auth data)
 * - Authentication/authorization checks via auth fixtures
 */

test.describe('Reject organization invitation', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-REJECT-INVITATION-001: should return 200 OK and mark invitation as rejected',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user and a valid pending invitation
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

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

      // Create invitee user first
      await signUp({
        email: 'invitee@example.com',
        password: 'InviteePass123!',
        name: 'Invitee User',
      })

      // Sign back in as owner to send invitation
      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      const inviteResponse = await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: org.id,
          email: 'invitee@example.com',
          role: 'member',
        },
      })
      const invitation = await inviteResponse.json()

      // Sign in as invitee
      await signIn({
        email: 'invitee@example.com',
        password: 'InviteePass123!',
      })

      // WHEN: User rejects the invitation
      const response = await page.request.post('/api/auth/organization/reject-invitation', {
        data: {
          invitationId: invitation.invitation?.id || invitation.id,
        },
      })

      // THEN: Returns 200 OK and marks invitation as rejected
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toMatchObject({ success: expect.any(Boolean) })
    }
  )

  test.fixme(
    'API-AUTH-ORG-REJECT-INVITATION-002: should return 400 Bad Request without invitationId',
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

      // WHEN: User submits request without invitationId
      const response = await page.request.post('/api/auth/organization/reject-invitation', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-REJECT-INVITATION-003: should return 401 Unauthorized',
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

      // WHEN: Unauthenticated user attempts to reject invitation
      const response = await page.request.post('/api/auth/organization/reject-invitation', {
        data: {
          invitationId: '1',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ORG-REJECT-INVITATION-004: should return 404 Not Found for non-existent invitation',
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

      // WHEN: User attempts to reject non-existent invitation
      const response = await page.request.post('/api/auth/organization/reject-invitation', {
        data: {
          invitationId: 'nonexistent-id',
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-REJECT-INVITATION-005: should return 410 Gone for expired invitation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user and an expired invitation
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

      // WHEN: User attempts to reject expired invitation
      const response = await page.request.post('/api/auth/organization/reject-invitation', {
        data: {
          invitationId: 'expired-invitation-id',
        },
      })

      // THEN: Returns 410 Gone
      expect(response.status()).toBe(410)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-REJECT-INVITATION-006: should return 404 Not Found for different user (prevent enumeration)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user and an invitation for different email
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

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

      // Create invitation for different email
      const inviteResponse = await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: org.id,
          email: 'invited@example.com',
          role: 'member',
        },
      })
      const invitation = await inviteResponse.json()

      // Create and sign in as different user
      await signUp({
        email: 'other@example.com',
        password: 'OtherPass123!',
        name: 'Other User',
      })

      // WHEN: User attempts to reject invitation not addressed to them
      const response = await page.request.post('/api/auth/organization/reject-invitation', {
        data: {
          invitationId: invitation.invitation?.id || invitation.id,
        },
      })

      // THEN: Returns 404 Not Found (prevent enumeration)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-REJECT-INVITATION-007: should return 409 Conflict for already rejected invitation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user and an invitation already rejected
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

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

      // Create invitee and invitation
      await signUp({
        email: 'invitee@example.com',
        password: 'InviteePass123!',
        name: 'Invitee User',
      })

      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      const inviteResponse = await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: org.id,
          email: 'invitee@example.com',
          role: 'member',
        },
      })
      const invitation = await inviteResponse.json()
      const invitationId = invitation.invitation?.id || invitation.id

      // Reject invitation first time
      await signIn({
        email: 'invitee@example.com',
        password: 'InviteePass123!',
      })

      await page.request.post('/api/auth/organization/reject-invitation', {
        data: { invitationId },
      })

      // WHEN: User attempts to reject the same invitation again
      const response = await page.request.post('/api/auth/organization/reject-invitation', {
        data: { invitationId },
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
    'API-AUTH-ORG-REJECT-INVITATION-008: user can complete full rejectInvitation workflow',
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

      // Test 1: Reject without auth fails
      const noAuthResponse = await page.request.post('/api/auth/organization/reject-invitation', {
        data: { invitationId: '1' },
      })
      expect(noAuthResponse.status()).toBe(401)

      // Create owner, organization, and invitation
      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })
      await signUp({
        email: 'invitee@example.com',
        password: 'InviteePass123!',
        name: 'Invitee User',
      })

      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      const inviteResponse = await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: org.id,
          email: 'invitee@example.com',
          role: 'member',
        },
      })
      const invitation = await inviteResponse.json()
      const invitationId = invitation.invitation?.id || invitation.id

      // Test 2: Reject invitation succeeds
      await signIn({
        email: 'invitee@example.com',
        password: 'InviteePass123!',
      })

      const rejectResponse = await page.request.post('/api/auth/organization/reject-invitation', {
        data: { invitationId },
      })
      expect(rejectResponse.status()).toBe(200)

      // Test 3: Reject again fails
      const duplicateResponse = await page.request.post(
        '/api/auth/organization/reject-invitation',
        {
          data: { invitationId },
        }
      )
      expect(duplicateResponse.status()).toBe(409)
    }
  )
})
