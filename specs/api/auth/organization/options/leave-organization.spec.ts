/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Leave Organization
 *
 * Domain: api
 * Spec Count: 3
 */

test.describe('Leave Organization', () => {
  test.fixme(
    'API-AUTH-ORG-OPT-LEAVE-001: should return 200 OK when member leaves organization',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request, addMember }) => {
      // GIVEN: Organization with a member
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

      const member = await signUp({
        email: 'member@example.com',
        password: 'Password123!',
        name: 'Member User',
      })

      await addMember({
        organizationId: owner.organizationId!,
        userId: member.user.id,
        role: 'member',
      })

      // WHEN: Member leaves the organization
      const response = await request.post('/api/auth/organization/leave', {
        data: {
          organizationId: owner.organizationId!,
        },
        headers: {
          Authorization: `Bearer ${member.session!.token}`,
        },
      })

      // THEN: Should return 200 OK
      expect(response.status()).toBe(200)

      // THEN: Member should no longer be in organization
      const members = await request
        .get('/api/auth/organization/list-members', {
          params: { organizationId: owner.organizationId! },
        })
        .then((r) => r.json())

      expect(members.find((m: any) => m.userId === member.user.id)).toBeUndefined()
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-LEAVE-003: should return 400 when owner tries to leave',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization owner
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

      // WHEN: Owner tries to leave organization
      const response = await request.post('/api/auth/organization/leave', {
        data: {
          organizationId: owner.organizationId!,
        },
      })

      // THEN: Should return 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('owner')
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-LEAVE-006: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ startServerWithSchema, request }) => {
      // GIVEN: Server without authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
      })

      // WHEN: Unauthenticated request to leave organization
      const response = await request.post('/api/auth/organization/leave', {
        data: {
          organizationId: 'some-org-id',
        },
      })

      // THEN: Should return 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-LEAVE-007: member can leave organization and verify cleanup',
    { tag: '@regression' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request, addMember }) => {
      // GIVEN: Organization with members and teams
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

      const member1 = await signUp({
        email: 'member1@example.com',
        password: 'Password123!',
        name: 'Member 1',
      })

      const member2 = await signUp({
        email: 'member2@example.com',
        password: 'Password123!',
        name: 'Member 2',
      })

      const { member: m1 } = await addMember({
        organizationId: owner.organizationId!,
        userId: member1.user.id,
        role: 'admin',
      })

      const { member: m2 } = await addMember({
        organizationId: owner.organizationId!,
        userId: member2.user.id,
        role: 'member',
      })

      // Create team with member
      const team = await request
        .post('/api/auth/organization/create-team', {
          data: {
            organizationId: owner.organizationId!,
            name: 'Engineering',
          },
        })
        .then((r) => r.json())

      await request.post('/api/auth/organization/add-team-member', {
        data: {
          teamId: team.id,
          memberId: m1.id,
        },
      })

      // WHEN/THEN: Member leaves organization
      const leaveResponse = await request.post('/api/auth/organization/leave', {
        data: { organizationId: owner.organizationId! },
        headers: { Authorization: `Bearer ${member1.session!.token}` },
      })
      expect(leaveResponse.status()).toBe(200)

      // THEN: Member removed from organization
      const members = await request
        .get('/api/auth/organization/list-members', {
          params: { organizationId: owner.organizationId! },
        })
        .then((r) => r.json())

      expect(members.length).toBe(2) // owner + member2
      expect(members.find((m: any) => m.id === m1.id)).toBeUndefined()

      // THEN: Member removed from team
      const teamMembers = await request
        .get('/api/auth/organization/list-team-members', {
          params: { teamId: team.id },
        })
        .then((r) => r.json())

      expect(teamMembers.find((tm: any) => tm.memberId === m1.id)).toBeUndefined()

      // WHEN/THEN: Owner cannot leave without transfer
      const ownerLeaveResponse = await request.post('/api/auth/organization/leave', {
        data: { organizationId: owner.organizationId! },
      })
      expect(ownerLeaveResponse.status()).toBe(400)

      // WHEN/THEN: Transfer ownership and then leave
      const transferResponse = await request.patch('/api/auth/organization/transfer-ownership', {
        data: {
          organizationId: owner.organizationId!,
          newOwnerId: m2.id,
        },
      })
      expect(transferResponse.status()).toBe(200)

      const ownerLeaveAfterTransfer = await request.post('/api/auth/organization/leave', {
        data: { organizationId: owner.organizationId! },
      })
      expect(ownerLeaveAfterTransfer.status()).toBe(200)

      // THEN: Organization still exists with new owner
      const finalMembers = await request
        .get('/api/auth/organization/list-members', {
          params: { organizationId: owner.organizationId! },
        })
        .then((r) => r.json())

      expect(finalMembers.length).toBe(1)
      expect(finalMembers[0].id).toBe(m2.id)
      expect(finalMembers[0].role).toBe('owner')
    }
  )
})
