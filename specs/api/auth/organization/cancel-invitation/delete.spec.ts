/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable drizzle/enforce-delete-with-where */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Cancel organization invitation
 *
 * Source: specs/api/paths/auth/organization/cancel-invitation/delete.json
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

test.describe('Cancel organization invitation', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-CANCEL-INVITATION-001: should return 200 OK and mark invitation as cancelled',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization owner and a pending invitation
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
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

      // Create invitation
      const inviteResponse = await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: org.id,
          email: 'invitee@example.com',
          role: 'member',
        },
      })
      const invitation = await inviteResponse.json()

      // WHEN: Owner cancels the invitation
      const response = await page.request.delete('/api/auth/organization/cancel-invitation', {
        data: {
          invitationId: invitation.invitation?.id || invitation.id,
        },
      })

      // THEN: Returns 200 OK and marks invitation as cancelled
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toMatchObject({ success: true })
    }
  )

  test.fixme(
    'API-AUTH-ORG-CANCEL-INVITATION-002: should return 400 Bad Request without invitationId',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
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

      // WHEN: Owner submits request without invitationId
      const response = await page.request.delete('/api/auth/organization/cancel-invitation', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-CANCEL-INVITATION-003: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { organization: true },
        },
      })

      // WHEN: Unauthenticated user attempts to cancel invitation
      const response = await page.request.delete('/api/auth/organization/cancel-invitation', {
        data: {
          invitationId: '1',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ORG-CANCEL-INVITATION-004: should return 403 Forbidden for regular member',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated regular member (not owner/admin)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
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

      // Create and add member
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

      // Create invitation as owner
      const inviteResponse = await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: org.id,
          email: 'invitee@example.com',
          role: 'member',
        },
      })
      const invitation = await inviteResponse.json()

      // Sign in as member
      await signIn({
        email: 'member@example.com',
        password: 'MemberPass123!',
      })

      // WHEN: Member attempts to cancel invitation
      const response = await page.request.delete('/api/auth/organization/cancel-invitation', {
        data: {
          invitationId: invitation.invitation?.id || invitation.id,
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-CANCEL-INVITATION-005: should return 404 Not Found for non-existent invitation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
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

      // WHEN: Owner attempts to cancel non-existent invitation
      const response = await page.request.delete('/api/auth/organization/cancel-invitation', {
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
    'API-AUTH-ORG-CANCEL-INVITATION-006: should return 409 Conflict for already accepted invitation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization owner and an accepted invitation
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
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

      // Create invitee
      await signUp({
        email: 'invitee@example.com',
        password: 'InviteePass123!',
        name: 'Invitee User',
      })

      // Sign back in as owner
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

      // Accept invitation
      await signIn({
        email: 'invitee@example.com',
        password: 'InviteePass123!',
      })

      await page.request.post('/api/auth/organization/accept-invitation', {
        data: { invitationId },
      })

      // Sign back in as owner
      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      // WHEN: Owner attempts to cancel already accepted invitation
      const response = await page.request.delete('/api/auth/organization/cancel-invitation', {
        data: { invitationId },
      })

      // THEN: Returns 409 Conflict
      expect(response.status()).toBe(409)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-CANCEL-INVITATION-007: should return 409 Conflict for already cancelled invitation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization owner and an already cancelled invitation
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
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

      const inviteResponse = await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: org.id,
          email: 'invitee@example.com',
          role: 'member',
        },
      })
      const invitation = await inviteResponse.json()
      const invitationId = invitation.invitation?.id || invitation.id

      // Cancel invitation first time
      await page.request.delete('/api/auth/organization/cancel-invitation', {
        data: { invitationId },
      })

      // WHEN: Owner attempts to cancel the same invitation again
      const response = await page.request.delete('/api/auth/organization/cancel-invitation', {
        data: { invitationId },
      })

      // THEN: Returns 409 Conflict
      expect(response.status()).toBe(409)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-CANCEL-INVITATION-008: should return 404 Not Found for different organization (prevent enumeration)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated owner of one organization and an invitation from different organization
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
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

      // Owner 2 creates organization 2 with invitation
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

      const inviteResponse = await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: org2.id,
          email: 'invitee@example.com',
          role: 'member',
        },
      })
      const invitation = await inviteResponse.json()

      // Sign back in as Owner 1
      await signIn({
        email: 'owner1@example.com',
        password: 'Owner1Pass123!',
      })

      // WHEN: Owner 1 attempts to cancel invitation from Organization 2
      const response = await page.request.delete('/api/auth/organization/cancel-invitation', {
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

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-CANCEL-INVITATION-009: user can complete full cancelInvitation workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { organization: true },
        },
      })

      // Test 1: Cancel without auth fails
      const noAuthResponse = await page.request.delete('/api/auth/organization/cancel-invitation', {
        data: { invitationId: '1' },
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

      const inviteResponse = await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: org.id,
          email: 'invitee@example.com',
          role: 'member',
        },
      })
      const invitation = await inviteResponse.json()
      const invitationId = invitation.invitation?.id || invitation.id

      // Test 2: Cancel invitation succeeds for owner
      const cancelResponse = await page.request.delete('/api/auth/organization/cancel-invitation', {
        data: { invitationId },
      })
      expect(cancelResponse.status()).toBe(200)

      // Test 3: Cancel again fails
      const duplicateResponse = await page.request.delete(
        '/api/auth/organization/cancel-invitation',
        {
          data: { invitationId },
        }
      )
      expect(duplicateResponse.status()).toBe(409)
    }
  )
})
