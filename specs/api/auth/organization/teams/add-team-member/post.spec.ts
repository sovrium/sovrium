/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Add Member to Team
 *
 * Domain: api
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('Add Team Member', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-TEAMS-ADD-MEMBER-001: should return 200 OK when owner adds organization member to team',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      signUp,
      createOrganization,
      inviteMember,
      acceptInvitation,
      page,
    }) => {
      // GIVEN: Organization with a team and a member
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            teams: true,
          },
        },
      })

      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      const { organization } = await createOrganization({
        name: 'Test Company',
        slug: 'test-company',
      })

      const teamResponse = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Engineering Team',
        },
      })
      const team = await teamResponse.json()

      const { invitation } = await inviteMember({
        organizationId: organization.id,
        email: 'member@example.com',
        role: 'member',
      })

      await signUp({
        email: 'member@example.com',
        password: 'MemberPass123!',
        name: 'Member User',
      })

      const memberAccept = await acceptInvitation(invitation.id)

      // WHEN: Owner adds member to team
      const response = await page.request.post('/api/auth/organization/add-team-member', {
        data: {
          teamId: team.id,
          userId: memberAccept.member.userId,
        },
      })

      // THEN: Returns 200 OK with team membership data
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('teamId', team.id)
      expect(data).toHaveProperty('userId', memberAccept.member.userId)
      expect(data).toHaveProperty('createdAt')
    }
  )

  test(
    'API-AUTH-ORG-TEAMS-ADD-MEMBER-002: should return 403 Forbidden when non-owner tries to add team member',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      signUp,
      createOrganization,
      inviteMember,
      acceptInvitation,
      page,
    }) => {
      // GIVEN: Organization with a team, owner, and two members
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            teams: true,
          },
        },
      })

      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      const { organization } = await createOrganization({
        name: 'Test Company',
        slug: 'test-company',
      })

      const teamResponse = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Engineering Team',
        },
      })
      const team = await teamResponse.json()

      // Member 1
      const { invitation: invitation1 } = await inviteMember({
        organizationId: organization.id,
        email: 'member1@example.com',
        role: 'member',
      })

      await signUp({
        email: 'member1@example.com',
        password: 'Member1Pass123!',
        name: 'Member One',
      })

      await acceptInvitation(invitation1.id)

      // Member 2
      const { invitation: invitation2 } = await inviteMember({
        organizationId: organization.id,
        email: 'member2@example.com',
        role: 'member',
      })

      await signUp({
        email: 'member2@example.com',
        password: 'Member2Pass123!',
        name: 'Member Two',
      })

      const member2Accept = await acceptInvitation(invitation2.id)

      // WHEN: Member 1 tries to add Member 2 to team
      const response = await page.request.post('/api/auth/organization/add-team-member', {
        data: {
          teamId: team.id,
          userId: member2Accept.member.userId,
        },
      })

      // THEN: Returns 403 Forbidden (only owner/admin can add team members)
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('permission')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-ADD-MEMBER-003: should return 400 Bad Request when user is not organization member',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: Organization with a team and a user outside organization
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            teams: true,
          },
        },
      })

      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      const { organization } = await createOrganization({
        name: 'Test Company',
        slug: 'test-company',
      })

      const teamResponse = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Engineering Team',
        },
      })
      const team = await teamResponse.json()

      await signUp({
        email: 'outsider@example.com',
        password: 'OutsiderPass123!',
        name: 'Outsider User',
      })

      // Get outsider user ID (assume API to get current user)
      const userResponse = await page.request.get('/api/auth/get-session')
      const userData = await userResponse.json()

      // WHEN: Owner tries to add non-member to team
      const response = await page.request.post('/api/auth/organization/add-team-member', {
        data: {
          teamId: team.id,
          userId: userData.user.id,
        },
      })

      // THEN: Returns 400 Bad Request (user must be org member first)
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('not a member')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-ADD-MEMBER-004: should return 409 Conflict when user is already team member',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      signUp,
      createOrganization,
      inviteMember,
      acceptInvitation,
      page,
    }) => {
      // GIVEN: Organization with team member already added
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            teams: true,
          },
        },
      })

      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      const { organization } = await createOrganization({
        name: 'Test Company',
        slug: 'test-company',
      })

      const teamResponse = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Engineering Team',
        },
      })
      const team = await teamResponse.json()

      const { invitation } = await inviteMember({
        organizationId: organization.id,
        email: 'member@example.com',
        role: 'member',
      })

      await signUp({
        email: 'member@example.com',
        password: 'MemberPass123!',
        name: 'Member User',
      })

      const memberAccept = await acceptInvitation(invitation.id)

      // Add member to team first time
      await page.request.post('/api/auth/organization/add-team-member', {
        data: {
          teamId: team.id,
          userId: memberAccept.member.userId,
        },
      })

      // WHEN: Owner tries to add same member again
      const response = await page.request.post('/api/auth/organization/add-team-member', {
        data: {
          teamId: team.id,
          userId: memberAccept.member.userId,
        },
      })

      // THEN: Returns 409 Conflict
      expect(response.status()).toBe(409)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('already a member')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-ADD-MEMBER-005: should return 404 Not Found when team does not exist',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      signUp,
      createOrganization,
      inviteMember,
      acceptInvitation,
      page,
    }) => {
      // GIVEN: Organization with member but non-existent team
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            teams: true,
          },
        },
      })

      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      const { organization } = await createOrganization({
        name: 'Test Company',
        slug: 'test-company',
      })

      const { invitation } = await inviteMember({
        organizationId: organization.id,
        email: 'member@example.com',
        role: 'member',
      })

      await signUp({
        email: 'member@example.com',
        password: 'MemberPass123!',
        name: 'Member User',
      })

      const memberAccept = await acceptInvitation(invitation.id)

      // WHEN: Owner tries to add member to non-existent team
      const response = await page.request.post('/api/auth/organization/add-team-member', {
        data: {
          teamId: 'non-existent-team-id',
          userId: memberAccept.member.userId,
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('not found')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-ADD-MEMBER-006: should return 401 Unauthorized when user is not authenticated',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: Server running without authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            teams: true,
          },
        },
      })

      // WHEN: Unauthenticated user tries to add team member
      const response = await page.request.post('/api/auth/organization/add-team-member', {
        data: {
          teamId: 'team-123',
          userId: 'user-456',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('Unauthorized')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-TEAMS-ADD-MEMBER-007: owner can add multiple members to team and verify membership',
    { tag: '@regression' },
    async ({
      startServerWithSchema,
      signUp,
      createOrganization,
      inviteMember,
      acceptInvitation,
      page,
    }) => {
      // GIVEN: Organization with team and multiple members
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            teams: true,
          },
        },
      })

      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      const { organization } = await createOrganization({
        name: 'Test Company',
        slug: 'test-company',
      })

      const teamResponse = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Engineering Team',
        },
      })
      const team = await teamResponse.json()

      // Add multiple members
      const memberEmails = ['member1@example.com', 'member2@example.com', 'member3@example.com']
      const memberIds = []

      for (const email of memberEmails) {
        const { invitation } = await inviteMember({
          organizationId: organization.id,
          email,
          role: 'member',
        })

        await signUp({
          email,
          password: 'MemberPass123!',
          name: `Member ${email}`,
        })

        const memberAccept = await acceptInvitation(invitation.id)

        memberIds.push(memberAccept.member.userId)

        // WHEN: Owner adds each member to team
        const addResponse = await page.request.post('/api/auth/organization/add-team-member', {
          data: {
            teamId: team.id,
            userId: memberAccept.member.userId,
          },
        })

        // THEN: Each member added successfully
        expect(addResponse.status()).toBe(200)
      }

      // THEN: List team members shows all added members
      const listResponse = await page.request.get(
        `/api/auth/organization/list-team-members?teamId=${team.id}`
      )

      expect(listResponse.status()).toBe(200)

      const teamMembers = await listResponse.json()
      expect(teamMembers).toHaveLength(3)

      const teamMemberIds = teamMembers.map((tm: { userId: string }) => tm.userId)
      memberIds.forEach((id) => {
        expect(teamMemberIds).toContain(id)
      })
    }
  )
})
