/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Organization Invitation Expiry
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('Organization Invitation Expiry', () => {
  test.fixme(
    'API-AUTH-ORG-OPT-INVITE-EXPIRY-001: should expire invitation after configured time',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with invitation expiry configured to 1 hour
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: owner.organizationId!,
          invitationExpiryHours: 1,
        },
      })

      // Create an invitation
      const invitation = await request
        .post('/api/auth/organization/invite-member', {
          data: {
            organizationId: owner.organizationId!,
            email: 'newuser@example.com',
            role: 'member',
          },
        })
        .then((r) => r.json())

      // WHEN: Time passes beyond expiry (simulate by updating invitation timestamp)
      await request.patch('/api/auth/organization/test/set-invitation-time', {
        data: {
          invitationId: invitation.id,
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        },
      })

      // THEN: Invitation should be marked as expired
      const response = await request.get('/api/auth/organization/get-invitation', {
        params: { invitationId: invitation.id },
      })

      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.expired).toBe(true)
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-INVITE-EXPIRY-002: should return 400 when accepting expired invitation',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request }) => {
      // GIVEN: Organization with expired invitation
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: owner.organizationId!,
          invitationExpiryHours: 1,
        },
      })

      const invitation = await request
        .post('/api/auth/organization/invite-member', {
          data: {
            organizationId: owner.organizationId!,
            email: 'newuser@example.com',
            role: 'member',
          },
        })
        .then((r) => r.json())

      // Expire the invitation
      await request.patch('/api/auth/organization/test/set-invitation-time', {
        data: {
          invitationId: invitation.id,
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
      })

      const newUser = await signUp({
        email: 'newuser@example.com',
        password: 'Password123!',
        name: 'New User',
      })

      // WHEN: User tries to accept expired invitation
      const response = await request.post('/api/auth/organization/accept-invitation', {
        data: {
          invitationId: invitation.id,
        },
        headers: {
          Authorization: `Bearer ${newUser.session!.token}`,
        },
      })

      // THEN: Should return 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('expired')
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-INVITE-EXPIRY-003: should reset expiry when resending invitation',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with expired invitation
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: owner.organizationId!,
          invitationExpiryHours: 24,
        },
      })

      const invitation = await request
        .post('/api/auth/organization/invite-member', {
          data: {
            organizationId: owner.organizationId!,
            email: 'newuser@example.com',
            role: 'member',
          },
        })
        .then((r) => r.json())

      // Expire the invitation
      await request.patch('/api/auth/organization/test/set-invitation-time', {
        data: {
          invitationId: invitation.id,
          createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48 hours ago
        },
      })

      // WHEN: Owner resends the invitation
      const response = await request.post('/api/auth/organization/resend-invitation', {
        data: {
          invitationId: invitation.id,
        },
      })

      // THEN: Invitation should be updated with new expiry time
      expect(response.status()).toBe(200)
      const updatedInvitation = await response.json()
      expect(updatedInvitation.expired).toBe(false)
      expect(new Date(updatedInvitation.expiresAt).getTime()).toBeGreaterThan(Date.now())
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-INVITE-EXPIRY-004: should support custom expiry per organization',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Two organizations with different expiry settings
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
      })

      const org1Owner = await createAuthenticatedUser({
        email: 'org1@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: org1Owner.organizationId,
          invitationExpiryHours: 24, // 1 day
        },
      })

      const org2Owner = await createAuthenticatedUser({
        email: 'org2@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: org2Owner.organizationId,
          invitationExpiryHours: 168, // 7 days
        },
      })

      // WHEN: Create invitations in both organizations
      const invite1 = await request
        .post('/api/auth/organization/invite-member', {
          data: {
            organizationId: org1Owner.organizationId,
            email: 'user1@example.com',
            role: 'member',
          },
        })
        .then((r) => r.json())

      const invite2 = await request
        .post('/api/auth/organization/invite-member', {
          data: {
            organizationId: org2Owner.organizationId,
            email: 'user2@example.com',
            role: 'member',
          },
        })
        .then((r) => r.json())

      // THEN: Invitations should have different expiry times
      const expiry1 = new Date(invite1.expiresAt).getTime()
      const expiry2 = new Date(invite2.expiresAt).getTime()

      expect(expiry2 - expiry1).toBeGreaterThan(6 * 24 * 60 * 60 * 1000) // ~6 days difference
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-INVITE-EXPIRY-005: should clean up expired invitations automatically',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with multiple expired invitations
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: owner.organizationId!,
          invitationExpiryHours: 1,
        },
      })

      // Create multiple invitations
      const invite1 = await request
        .post('/api/auth/organization/invite-member', {
          data: {
            organizationId: owner.organizationId!,
            email: 'user1@example.com',
            role: 'member',
          },
        })
        .then((r) => r.json())

      const invite2 = await request
        .post('/api/auth/organization/invite-member', {
          data: {
            organizationId: owner.organizationId!,
            email: 'user2@example.com',
            role: 'member',
          },
        })
        .then((r) => r.json())

      // Expire both invitations
      await request.patch('/api/auth/organization/test/set-invitation-time', {
        data: {
          invitationId: invite1.id,
          createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        },
      })

      await request.patch('/api/auth/organization/test/set-invitation-time', {
        data: {
          invitationId: invite2.id,
          createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        },
      })

      // WHEN: Cleanup job runs
      const response = await request.post('/api/auth/organization/cleanup-expired-invitations', {
        data: { organizationId: owner.organizationId! },
      })

      // THEN: Expired invitations should be removed
      expect(response.status()).toBe(200)
      const result = await response.json()
      expect(result.deletedCount).toBe(2)

      // THEN: Invitations should no longer exist
      const invitations = await request
        .get('/api/auth/organization/list-invitations', {
          params: { organizationId: owner.organizationId! },
        })
        .then((r) => r.json())

      expect(invitations.length).toBe(0)
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-INVITE-EXPIRY-006: should include expiry timestamp in response',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with invitation expiry configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: owner.organizationId!,
          invitationExpiryHours: 72, // 3 days
        },
      })

      // WHEN: Owner creates an invitation
      const response = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'newuser@example.com',
          role: 'member',
        },
      })

      // THEN: Response should include expiry timestamp
      expect(response.status()).toBe(200)
      const invitation = await response.json()
      expect(invitation.expiresAt).toBeDefined()
      expect(typeof invitation.expiresAt).toBe('string')

      // THEN: Expiry should be ~3 days from now
      const expiresAt = new Date(invitation.expiresAt).getTime()
      const expectedExpiry = Date.now() + 72 * 60 * 60 * 1000
      const tolerance = 5 * 60 * 1000 // 5 minutes tolerance

      expect(Math.abs(expiresAt - expectedExpiry)).toBeLessThan(tolerance)
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-INVITE-EXPIRY-007: system can manage invitation expiry lifecycle',
    { tag: '@regression' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request }) => {
      // GIVEN: Organization with invitation expiry configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: owner.organizationId!,
          invitationExpiryHours: 24,
        },
      })

      // WHEN/THEN: Create invitation with expiry
      const createResponse = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'newuser@example.com',
          role: 'member',
        },
      })
      expect(createResponse.status()).toBe(200)
      const invitation = await createResponse.json()
      expect(invitation.expiresAt).toBeDefined()

      // WHEN/THEN: Valid invitation can be accepted
      const newUser = await signUp({
        email: 'newuser@example.com',
        password: 'Password123!',
        name: 'New User',
      })

      const acceptResponse = await request.post('/api/auth/organization/accept-invitation', {
        data: { invitationId: invitation.id },
        headers: { Authorization: `Bearer ${newUser.session!.token}` },
      })
      expect(acceptResponse.status()).toBe(200)

      // WHEN/THEN: Create new invitation that will expire
      const invite2 = await request
        .post('/api/auth/organization/invite-member', {
          data: {
            organizationId: owner.organizationId!,
            email: 'user2@example.com',
            role: 'admin',
          },
        })
        .then((r) => r.json())

      // Expire the invitation
      await request.patch('/api/auth/organization/test/set-invitation-time', {
        data: {
          invitationId: invite2.id,
          createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        },
      })

      // WHEN/THEN: Expired invitation cannot be accepted
      const user2 = await signUp({
        email: 'user2@example.com',
        password: 'Password123!',
        name: 'User 2',
      })

      const expiredAccept = await request.post('/api/auth/organization/accept-invitation', {
        data: { invitationId: invite2.id },
        headers: { Authorization: `Bearer ${user2.session!.token}` },
      })
      expect(expiredAccept.status()).toBe(400)

      // WHEN/THEN: Resend invitation resets expiry
      const resendResponse = await request.post('/api/auth/organization/resend-invitation', {
        data: { invitationId: invite2.id },
      })
      expect(resendResponse.status()).toBe(200)
      const renewedInvite = await resendResponse.json()
      expect(renewedInvite.expired).toBe(false)

      // WHEN/THEN: Cleanup removes only truly expired invitations
      await request.patch('/api/auth/organization/test/set-invitation-time', {
        data: {
          invitationId: invite2.id,
          createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
        },
      })

      const cleanupResponse = await request.post(
        '/api/auth/organization/cleanup-expired-invitations',
        {
          data: { organizationId: owner.organizationId! },
        }
      )
      expect(cleanupResponse.status()).toBe(200)

      const invitations = await request
        .get('/api/auth/organization/list-invitations', {
          params: { organizationId: owner.organizationId! },
        })
        .then((r) => r.json())

      expect(invitations.length).toBe(0)
    }
  )
})
