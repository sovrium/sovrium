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

  test(
    'API-AUTH-ORG-OPT-LEAVE-002: should return 400 when owner tries to leave',
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

  test(
    'API-AUTH-ORG-OPT-LEAVE-003: should return 401 when not authenticated',
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
    'API-AUTH-ORG-OPT-LEAVE-REGRESSION: member can leave organization and verify cleanup',
    { tag: '@regression' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request, addMember }) => {
      let owner: Awaited<ReturnType<typeof createAuthenticatedUser>>
      let member1: Awaited<ReturnType<typeof signUp>>
      let member2: Awaited<ReturnType<typeof signUp>>
      let m1: { id: string }
      let m2: { id: string }
      let team: { id: string }

      await test.step('Setup: Start server with comprehensive configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            organization: true,
          },
        })

        owner = await createAuthenticatedUser({
          email: 'owner@example.com',
          password: 'Password123!',
          createOrganization: true,
        })

        member1 = await signUp({
          email: 'member1@example.com',
          password: 'Password123!',
          name: 'Member 1',
        })

        member2 = await signUp({
          email: 'member2@example.com',
          password: 'Password123!',
          name: 'Member 2',
        })

        const result1 = await addMember({
          organizationId: owner.organizationId!,
          userId: member1.user.id,
          role: 'admin',
        })
        m1 = result1.member

        const result2 = await addMember({
          organizationId: owner.organizationId!,
          userId: member2.user.id,
          role: 'member',
        })
        m2 = result2.member

        // Create team with member
        team = await request
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
      })

      await test.step('API-AUTH-ORG-OPT-LEAVE-001: Returns 200 OK when member leaves organization', async () => {
        // WHEN: Member leaves the organization
        const leaveResponse = await request.post('/api/auth/organization/leave', {
          data: { organizationId: owner.organizationId! },
          headers: { Authorization: `Bearer ${member1.session!.token}` },
        })

        // THEN: Should return 200 OK
        expect(leaveResponse.status()).toBe(200)

        // THEN: Member should no longer be in organization
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
      })

      await test.step('API-AUTH-ORG-OPT-LEAVE-002: Returns 400 when owner tries to leave', async () => {
        // WHEN: Owner tries to leave organization
        const ownerLeaveResponse = await request.post('/api/auth/organization/leave', {
          data: { organizationId: owner.organizationId! },
        })

        // THEN: Should return 400 Bad Request
        expect(ownerLeaveResponse.status()).toBe(400)
      })

      await test.step('API-AUTH-ORG-OPT-LEAVE-003: Returns 401 when not authenticated', async () => {
        // WHEN: Unauthenticated request to leave organization (simulated by clearing auth)
        const response = await request.post('/api/auth/organization/leave', {
          data: { organizationId: 'some-org-id' },
          headers: { Authorization: '' },
        })

        // THEN: Should return 401 Unauthorized
        expect(response.status()).toBe(401)
      })

      await test.step('Verifies ownership transfer allows original owner to leave', async () => {
        // WHEN: Transfer ownership
        const transferResponse = await request.patch('/api/auth/organization/transfer-ownership', {
          data: {
            organizationId: owner.organizationId!,
            newOwnerId: m2.id,
          },
        })
        expect(transferResponse.status()).toBe(200)

        // WHEN: Original owner leaves after transfer
        const ownerLeaveAfterTransfer = await request.post('/api/auth/organization/leave', {
          data: { organizationId: owner.organizationId! },
        })

        // THEN: Should succeed
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
      })
    }
  )
})
