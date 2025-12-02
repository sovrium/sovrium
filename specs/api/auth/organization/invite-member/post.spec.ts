/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Invite member to organization
 *
 * Source: specs/api/paths/auth/organization/invite-member/post.json
 * Domain: api
 * Spec Count: 9
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (9 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Email capture via Mailpit fixture for invitation verification
 * - Authentication/authorization checks via auth fixtures
 */

test.describe('Invite member to organization', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-INVITE-MEMBER-001: should return 201 Created with invitation token and send email with custom template',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn, mailpit }) => {
      // GIVEN: An authenticated organization owner with custom email templates
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
          emailTemplates: {
            organizationInvitation: {
              subject: 'You have been invited to join $organizationName',
              text: 'Hi, $inviterName has invited you to join $organizationName. Click here: $url',
            },
          },
        },
      })

      const ownerEmail = mailpit.email('owner')
      const inviteeEmail = mailpit.email('newuser')

      await signUp({
        email: ownerEmail,
        password: 'OwnerPass123!',
        name: 'Owner User',
      })
      await signIn({
        email: ownerEmail,
        password: 'OwnerPass123!',
      })

      // Create organization
      const createResponse = await page.request.post('/api/auth/organization/create-organization', {
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      // WHEN: Owner invites new user by email
      const response = await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: org.organization.id,
          email: inviteeEmail,
          role: 'member',
        },
      })

      // THEN: Returns 200 OK with invitation data and sends email with custom template
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('invitation')

      // Verify invitation email was sent with custom subject
      const email = await mailpit.waitForEmail(
        (e) => e.To[0]?.Address === inviteeEmail && e.Subject.includes('invited to join Test Org')
      )
      expect(email).toBeDefined()
      expect(email.Subject).toBe('You have been invited to join Test Org')
    }
  )

  test.fixme(
    'API-AUTH-ORG-INVITE-MEMBER-002: should return 400 Bad Request without required fields',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization owner
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
      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })

      // WHEN: Owner submits request without required fields
      const response = await page.request.post('/api/auth/organization/invite-member', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation errors
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-INVITE-MEMBER-003: should return 400 Bad Request with invalid email format',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization owner
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
      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })

      // WHEN: Owner submits invitation with invalid email format
      const response = await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: '1',
          email: 'invalid-email',
          role: 'member',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-INVITE-MEMBER-004: should return 401 Unauthorized',
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

      // WHEN: Unauthenticated user attempts to invite member
      const response = await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: '1',
          email: 'newuser@example.com',
          role: 'member',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ORG-INVITE-MEMBER-005: should return 403 Forbidden for regular member',
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

      // Sign in as member
      await signIn({
        email: 'member@example.com',
        password: 'MemberPass123!',
      })

      // WHEN: Member attempts to invite another user
      const response = await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: org.id,
          email: 'newuser@example.com',
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
    'API-AUTH-ORG-INVITE-MEMBER-006: should return 404 Not Found for non-existent organization',
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
      await signIn({
        email: 'user@example.com',
        password: 'UserPass123!',
      })

      // WHEN: User attempts to invite to non-existent organization
      const response = await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: 'nonexistent-id',
          email: 'newuser@example.com',
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
    'API-AUTH-ORG-INVITE-MEMBER-007: should return 409 Conflict for existing member',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization owner and an existing member
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
      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      // Create and add existing member
      await signUp({
        email: 'existing@example.com',
        password: 'ExistingPass123!',
        name: 'Existing Member',
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

      // WHEN: Owner attempts to invite existing member
      const response = await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: org.id,
          email: 'existing@example.com',
          role: 'member',
        },
      })

      // THEN: Returns 409 Conflict
      expect(response.status()).toBe(409)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-INVITE-MEMBER-008: should return 409 Conflict for pending invitation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization owner and an existing pending invitation
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
      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      // First invitation
      await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: org.id,
          email: 'pending@example.com',
          role: 'member',
        },
      })

      // WHEN: Owner attempts to invite user with pending invitation
      const response = await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: org.id,
          email: 'pending@example.com',
          role: 'member',
        },
      })

      // THEN: Returns 409 Conflict
      expect(response.status()).toBe(409)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-INVITE-MEMBER-009: should return 409 Conflict (case-insensitive email)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization owner and an existing member
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
      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      await signUp({
        email: 'existing@example.com',
        password: 'ExistingPass123!',
        name: 'Existing Member',
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

      // WHEN: Owner invites user with email in different case
      const response = await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: org.id,
          email: 'EXISTING@EXAMPLE.COM',
          role: 'member',
        },
      })

      // THEN: Returns 409 Conflict (case-insensitive)
      expect(response.status()).toBe(409)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-INVITE-MEMBER-010: user can complete full inviteMember workflow',
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

      // Test 1: Invite without auth fails
      const noAuthResponse = await page.request.post('/api/auth/organization/invite-member', {
        data: { organizationId: '1', email: 'new@example.com', role: 'member' },
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

      // Test 2: Invite succeeds for owner
      const inviteResponse = await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: org.id,
          email: 'newmember@example.com',
          role: 'member',
        },
      })
      expect(inviteResponse.status()).toBe(201)

      // Test 3: Duplicate invite fails
      const duplicateResponse = await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: org.id,
          email: 'newmember@example.com',
          role: 'member',
        },
      })
      expect(duplicateResponse.status()).toBe(409)
    }
  )
})
