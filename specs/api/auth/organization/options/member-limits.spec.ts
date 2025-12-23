/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Organization Member Limits
 *
 * Domain: api
 * Spec Count: 7
 */

test.describe('Organization Member Limits', () => {
  test.fixme(
    'API-AUTH-ORG-OPT-MEMBER-LIMIT-001: should enforce max member limit on invite',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with member limit configured
      await startServerWithSchema({ name: 'test-app' })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: owner.organizationId!,
          memberLimit: 3,
        },
      })

      // WHEN: Invite within limit
      const invite1 = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user1@example.com',
          role: 'member',
        },
      })

      const invite2 = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user2@example.com',
          role: 'member',
        },
      })

      // THEN: Invitations succeed (owner + 2 invites = 3 total)
      expect(invite1.status()).toBe(200)
      expect(invite2.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-MEMBER-LIMIT-002: should return 400 when inviting at capacity',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization at member capacity
      await startServerWithSchema({ name: 'test-app' })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: owner.organizationId!,
          memberLimit: 2,
        },
      })

      // Invite first member (owner + 1 invite = 2 total)
      await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user1@example.com',
          role: 'member',
        },
      })

      // WHEN: Try to invite beyond capacity
      const response = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user2@example.com',
          role: 'member',
        },
      })

      // THEN: Should return 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('limit')
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-MEMBER-LIMIT-003: should allow invite after member removal',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request, addMember }) => {
      // GIVEN: Organization at member capacity
      await startServerWithSchema({ name: 'test-app' })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: owner.organizationId!,
          memberLimit: 2,
        },
      })

      const member = await signUp({
        email: 'member@example.com',
        password: 'Password123!',
        name: 'Member User',
      })

      const { member: memberRecord } = await addMember({
        organizationId: owner.organizationId!,
        userId: member.user.id,
        role: 'member',
      })

      // WHEN: Remove member and invite new one
      await request.delete('/api/auth/organization/remove-member', {
        data: {
          organizationId: owner.organizationId!,
          memberId: memberRecord.id,
        },
      })

      const response = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'newuser@example.com',
          role: 'member',
        },
      })

      // THEN: Invitation should succeed
      expect(response.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-MEMBER-LIMIT-004: should support different limits per plan tier',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organizations with different plan tiers
      await startServerWithSchema({ name: 'test-app' })

      const basicOrg = await createAuthenticatedUser({
        email: 'basic@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: basicOrg.organizationId!,
          planTier: 'basic',
          memberLimit: 5,
        },
      })

      const proOrg = await createAuthenticatedUser({
        email: 'pro@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: proOrg.organizationId!,
          planTier: 'pro',
          memberLimit: 50,
        },
      })

      // WHEN: Check settings
      const basicSettings = await request
        .get('/api/auth/organization/get-settings', {
          params: { organizationId: basicOrg.organizationId! },
        })
        .then((r) => r.json())

      const proSettings = await request
        .get('/api/auth/organization/get-settings', {
          params: { organizationId: proOrg.organizationId! },
        })
        .then((r) => r.json())

      // THEN: Different limits should be configured
      expect(basicSettings.memberLimit).toBe(5)
      expect(proSettings.memberLimit).toBe(50)
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-MEMBER-LIMIT-005: should count pending invitations toward limit',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with member limit
      await startServerWithSchema({ name: 'test-app' })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: owner.organizationId!,
          memberLimit: 3,
        },
      })

      // Create pending invitations
      await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user1@example.com',
          role: 'member',
        },
      })

      await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user2@example.com',
          role: 'member',
        },
      })

      // WHEN: Try to invite beyond capacity (owner + 2 pending = 3)
      const response = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user3@example.com',
          role: 'member',
        },
      })

      // THEN: Should be rejected (pending invitations count toward limit)
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('limit')
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-MEMBER-LIMIT-006: should return remaining seats in response',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with member limit
      await startServerWithSchema({ name: 'test-app' })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: owner.organizationId!,
          memberLimit: 10,
        },
      })

      // WHEN: Get organization details
      const response = await request.get('/api/auth/organization/get-details', {
        params: { organizationId: owner.organizationId! },
      })

      // THEN: Response should include seat information
      expect(response.status()).toBe(200)
      const org = await response.json()
      expect(org.memberLimit).toBe(10)
      expect(org.currentMemberCount).toBe(1) // Owner only
      expect(org.remainingSeats).toBe(9)
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-MEMBER-LIMIT-007: system can manage member limits across lifecycle',
    { tag: '@regression' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request, addMember }) => {
      // GIVEN: Organization with member limit
      await startServerWithSchema({ name: 'test-app' })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update-settings', {
        data: {
          organizationId: owner.organizationId!,
          memberLimit: 3,
        },
      })

      // WHEN/THEN: Invite members within limit
      const invite1 = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user1@example.com',
          role: 'member',
        },
      })
      expect(invite1.status()).toBe(200)

      const invite2 = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user2@example.com',
          role: 'member',
        },
      })
      expect(invite2.status()).toBe(200)

      // WHEN/THEN: Reject invitation at capacity
      const invite3 = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user3@example.com',
          role: 'member',
        },
      })
      expect(invite3.status()).toBe(400)

      // WHEN/THEN: Cancel invitation frees up seat
      const invitations = await request
        .get('/api/auth/organization/list-invitations', {
          params: { organizationId: owner.organizationId! },
        })
        .then((r) => r.json())

      await request.delete('/api/auth/organization/cancel-invitation', {
        data: {
          invitationId: invitations[0].id,
        },
      })

      const invite4 = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'user4@example.com',
          role: 'member',
        },
      })
      expect(invite4.status()).toBe(200)

      // WHEN/THEN: Add members and verify count
      const user2 = await signUp({
        email: 'user2@example.com',
        password: 'Password123!',
        name: 'User 2',
      })

      const { member: m2 } = await addMember({
        organizationId: owner.organizationId!,
        userId: user2.user.id,
        role: 'member',
      })

      const orgDetails = await request
        .get('/api/auth/organization/get-details', {
          params: { organizationId: owner.organizationId! },
        })
        .then((r) => r.json())

      expect(orgDetails.currentMemberCount).toBe(2) // owner + m2
      expect(orgDetails.remainingSeats).toBe(1)

      // WHEN/THEN: Remove member frees seat
      await request.delete('/api/auth/organization/remove-member', {
        data: {
          organizationId: owner.organizationId!,
          memberId: m2.id,
        },
      })

      const finalDetails = await request
        .get('/api/auth/organization/get-details', {
          params: { organizationId: owner.organizationId! },
        })
        .then((r) => r.json())

      expect(finalDetails.currentMemberCount).toBe(1) // owner only
      expect(finalDetails.remainingSeats).toBe(2)
    }
  )
})
