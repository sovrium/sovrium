/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Accept organization invitation
 *
 * Source: specs/api/paths/auth/organization/accept-invitation/post.json
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
 *
 * Note: These tests require invitation workflow which creates invitation IDs
 */

test.describe('Accept organization invitation', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-ACCEPT-INVITATION-001: should return 200 OK and add user to organization',
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

      // WHEN: User accepts the invitation
      const response = await page.request.post('/api/auth/organization/accept-invitation', {
        data: {
          invitationId: invitation.invitation?.id || invitation.id,
        },
      })

      // THEN: Returns 200 OK and adds user to organization
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('member')
    }
  )

  test.fixme(
    'API-AUTH-ORG-ACCEPT-INVITATION-002: should return 400 Bad Request without invitationId',
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

      // WHEN: User submits request without invitationId
      const response = await page.request.post('/api/auth/organization/accept-invitation', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-ACCEPT-INVITATION-003: should return 401 Unauthorized',
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

      // WHEN: Unauthenticated user attempts to accept invitation
      const response = await page.request.post('/api/auth/organization/accept-invitation', {
        data: {
          invitationId: '1',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ORG-ACCEPT-INVITATION-004: should return 404 Not Found for non-existent invitation',
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

      // WHEN: User attempts to accept non-existent invitation
      const response = await page.request.post('/api/auth/organization/accept-invitation', {
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
    'API-AUTH-ORG-ACCEPT-INVITATION-005: should return 410 Gone for expired invitation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated user and an expired invitation
      // Note: This test requires the ability to create expired invitations
      // which typically happens through database manipulation or time-based expiry
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

      // WHEN: User attempts to accept expired invitation
      // Note: Actual expired invitation would need to be created
      const response = await page.request.post('/api/auth/organization/accept-invitation', {
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
    'API-AUTH-ORG-ACCEPT-INVITATION-006: should return 409 Conflict for already member',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user who is already organization member
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

      // Create member
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

      // Add member directly
      await page.request.post('/api/auth/organization/add-member', {
        data: {
          organizationId: org.id,
          userId: '2',
          role: 'member',
        },
      })

      // Also create invitation for the same member
      await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: org.id,
          email: 'member@example.com',
          role: 'member',
        },
      })

      // If invitation was created (might return 409 for existing member)
      // Sign in as member and try to accept
      await signIn({
        email: 'member@example.com',
        password: 'MemberPass123!',
      })

      // WHEN: User attempts to accept invitation
      const response = await page.request.post('/api/auth/organization/accept-invitation', {
        data: {
          invitationId: '1',
        },
      })

      // THEN: Returns 409 Conflict
      expect(response.status()).toBe(409)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-ACCEPT-INVITATION-007: should return 404 Not Found for different user (prevent enumeration)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
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

      // WHEN: User attempts to accept invitation not addressed to them
      const response = await page.request.post('/api/auth/organization/accept-invitation', {
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
    'API-AUTH-ORG-ACCEPT-INVITATION-008: should return 409 Conflict for already accepted invitation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user and an invitation already accepted
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

      // Accept invitation first time
      await signIn({
        email: 'invitee@example.com',
        password: 'InviteePass123!',
      })

      await page.request.post('/api/auth/organization/accept-invitation', {
        data: { invitationId },
      })

      // WHEN: User attempts to accept the same invitation again
      const response = await page.request.post('/api/auth/organization/accept-invitation', {
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
    'API-AUTH-ORG-ACCEPT-INVITATION-009: user can complete full acceptInvitation workflow',
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

      // Test 1: Accept without auth fails
      const noAuthResponse = await page.request.post('/api/auth/organization/accept-invitation', {
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

      // Test 2: Accept invitation succeeds
      await signIn({
        email: 'invitee@example.com',
        password: 'InviteePass123!',
      })

      const acceptResponse = await page.request.post('/api/auth/organization/accept-invitation', {
        data: { invitationId },
      })
      expect(acceptResponse.status()).toBe(200)

      // Test 3: Accept again fails
      const duplicateResponse = await page.request.post(
        '/api/auth/organization/accept-invitation',
        {
          data: { invitationId },
        }
      )
      expect(duplicateResponse.status()).toBe(409)
    }
  )
})
