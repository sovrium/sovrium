/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Remove Member from Team
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('Remove Team Member', () => {
  test.fixme(
    'API-AUTH-ORG-TEAMS-REMOVE-MEMBER-001: should return 200 OK when owner removes member from team',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      signUp,
      createOrganization,
      inviteMember,
      acceptInvitation,
      page,
    }) => {
      // GIVEN: Team with a member
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            teams: true,
          },
        },
      })

      await signUp({ email: 'owner@example.com', password: 'Pass123!', name: 'Owner' })
      const { organization } = await createOrganization({ name: 'Company', slug: 'company' })

      const teamResponse = await page.request.post('/api/auth/organization/create-team', {
        data: { organizationId: organization.id, name: 'Team' },
      })
      const { id: teamId } = await teamResponse.json()

      const { invitation } = await inviteMember({
        organizationId: organization.id,
        email: 'member@example.com',
        role: 'member',
      })
      await signUp({ email: 'member@example.com', password: 'Pass123!', name: 'Member' })
      const memberAccept = await acceptInvitation(invitation.id)

      await page.request.post('/api/auth/organization/add-team-member', {
        data: { teamId, userId: memberAccept.member.userId },
      })

      // WHEN: Owner removes member from team
      const response = await page.request.delete('/api/auth/organization/remove-team-member', {
        data: { teamId, userId: memberAccept.member.userId },
      })

      // THEN: Returns 200 OK
      expect(response.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-REMOVE-MEMBER-002: should return 403 when non-owner tries to remove member',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, addMember, page }) => {
      // GIVEN: Organization with team and members, non-owner trying to remove
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            teams: true,
          },
        },
      })
      await signUp({ email: 'owner@example.com', password: 'Pass123!', name: 'Owner' })
      const { organization } = await createOrganization({ name: 'Company', slug: 'company' })

      const teamResponse = await page.request.post('/api/auth/organization/create-team', {
        data: { organizationId: organization.id, name: 'Engineering' },
      })
      const { id: teamId } = await teamResponse.json()

      const member1Response = await signUp({
        email: 'member1@example.com',
        password: 'Pass123!',
        name: 'Member 1',
      })
      await addMember({
        organizationId: organization.id,
        userId: member1Response.user.id,
        role: 'member',
      })

      const member2Response = await signUp({
        email: 'member2@example.com',
        password: 'Pass123!',
        name: 'Member 2',
      })
      const { member: m2 } = await addMember({
        organizationId: organization.id,
        userId: member2Response.user.id,
        role: 'member',
      })

      await page.request.post('/api/auth/organization/add-team-member', {
        data: { teamId, userId: m2.userId },
      })

      // WHEN: Non-owner (member1) tries to remove member2 from team
      await page.goto('/login')
      await page.fill('input[name="email"]', 'member1@example.com')
      await page.fill('input[name="password"]', 'Pass123!')
      await page.click('button[type="submit"]')

      const response = await page.request.delete('/api/auth/organization/remove-team-member', {
        data: { teamId, userId: m2.userId },
      })

      // THEN: Should return 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )
  test.fixme(
    'API-AUTH-ORG-TEAMS-REMOVE-MEMBER-003: should return 400 when user is not team member',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, addMember, page }) => {
      // GIVEN: Team with no members
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            teams: true,
          },
        },
      })
      await signUp({ email: 'owner@example.com', password: 'Pass123!', name: 'Owner' })
      const { organization } = await createOrganization({ name: 'Company', slug: 'company' })

      const teamResponse = await page.request.post('/api/auth/organization/create-team', {
        data: { organizationId: organization.id, name: 'Team' },
      })
      const { id: teamId } = await teamResponse.json()

      const memberResponse = await signUp({
        email: 'member@example.com',
        password: 'Pass123!',
        name: 'Member',
      })
      const { member } = await addMember({
        organizationId: organization.id,
        userId: memberResponse.user.id,
        role: 'member',
      })

      // WHEN: Owner tries to remove member that's not in team
      const response = await page.request.delete('/api/auth/organization/remove-team-member', {
        data: { teamId, userId: member.userId },
      })

      // THEN: Should return 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('member')
    }
  )
  test.fixme(
    'API-AUTH-ORG-TEAMS-REMOVE-MEMBER-004: should return 404 when team does not exist',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: User with organization but non-existent team
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            teams: true,
          },
        },
      })
      await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })
      await createOrganization({ name: 'Company', slug: 'company' })

      // WHEN: User tries to remove member from non-existent team
      const response = await page.request.delete('/api/auth/organization/remove-team-member', {
        data: { teamId: 'non-existent-team-id', userId: 'some-user-id' },
      })

      // THEN: Should return 404 Not Found
      expect(response.status()).toBe(404)
    }
  )
  test.fixme(
    'API-AUTH-ORG-TEAMS-REMOVE-MEMBER-005: should return 400 when userId or teamId missing',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: User with team
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            teams: true,
          },
        },
      })
      await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })
      const { organization } = await createOrganization({ name: 'Company', slug: 'company' })

      const teamResponse = await page.request.post('/api/auth/organization/create-team', {
        data: { organizationId: organization.id, name: 'Team' },
      })
      const { id: teamId } = await teamResponse.json()

      // WHEN: User tries to remove member without providing userId
      const response1 = await page.request.delete('/api/auth/organization/remove-team-member', {
        data: { teamId },
      })

      // THEN: Should return 400 Bad Request
      expect(response1.status()).toBe(400)
      const error1 = await response1.json()
      expect(error1.message).toContain('userId')

      // WHEN: User tries to remove member without providing teamId
      const response2 = await page.request.delete('/api/auth/organization/remove-team-member', {
        data: { userId: 'some-user-id' },
      })

      // THEN: Should return 400 Bad Request
      expect(response2.status()).toBe(400)
      const error2 = await response2.json()
      expect(error2.message).toContain('teamId')
    }
  )
  test.fixme(
    'API-AUTH-ORG-TEAMS-REMOVE-MEMBER-006: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ startServerWithSchema, request }) => {
      // GIVEN: Server without authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            teams: true,
          },
        },
      })

      // WHEN: Unauthenticated request to remove team member
      const response = await request.delete('/api/auth/organization/remove-team-member', {
        data: { teamId: 'some-team-id', userId: 'some-user-id' },
      })

      // THEN: Should return 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )
  test.fixme(
    'API-AUTH-ORG-TEAMS-REMOVE-MEMBER-REGRESSION: owner can remove team members with full workflow',
    { tag: '@regression' },
    async ({
      startServerWithSchema,
      signUp,
      createOrganization,
      inviteMember: _inviteMember,
      acceptInvitation: _acceptInvitation,
      addMember,
      page,
      request,
    }) => {
      let organization: { id: string }
      let teamId: string
      let member1UserId: string
      let member2UserId: string

      await test.step('Setup: Start server with comprehensive configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            organization: {
              teams: true,
            },
          },
        })
      })

      await test.step('API-AUTH-ORG-TEAMS-REMOVE-MEMBER-006: Returns 401 when not authenticated', async () => {
        // WHEN: Unauthenticated request to remove team member
        const response = await request.delete('/api/auth/organization/remove-team-member', {
          data: { teamId: 'some-team-id', userId: 'some-user-id' },
        })

        // THEN: Should return 401 Unauthorized
        expect(response.status()).toBe(401)
      })

      await test.step('Setup: Create owner and organization with team', async () => {
        await signUp({ email: 'owner@example.com', password: 'Pass123!', name: 'Owner' })
        const result = await createOrganization({ name: 'Company', slug: 'company' })
        organization = result.organization

        const teamResponse = await page.request.post('/api/auth/organization/create-team', {
          data: { organizationId: organization.id, name: 'Engineering' },
        })
        const team = await teamResponse.json()
        teamId = team.id
      })

      await test.step('API-AUTH-ORG-TEAMS-REMOVE-MEMBER-005: Returns 400 when userId or teamId missing', async () => {
        // WHEN: User tries to remove member without providing userId
        const response1 = await page.request.delete('/api/auth/organization/remove-team-member', {
          data: { teamId },
        })

        // THEN: Should return 400 Bad Request
        expect(response1.status()).toBe(400)
        const error1 = await response1.json()
        expect(error1.message).toContain('userId')

        // WHEN: User tries to remove member without providing teamId
        const response2 = await page.request.delete('/api/auth/organization/remove-team-member', {
          data: { userId: 'some-user-id' },
        })

        // THEN: Should return 400 Bad Request
        expect(response2.status()).toBe(400)
        const error2 = await response2.json()
        expect(error2.message).toContain('teamId')
      })

      await test.step('API-AUTH-ORG-TEAMS-REMOVE-MEMBER-004: Returns 404 when team does not exist', async () => {
        // WHEN: User tries to remove member from non-existent team
        const response = await page.request.delete('/api/auth/organization/remove-team-member', {
          data: { teamId: 'non-existent-team-id', userId: 'some-user-id' },
        })

        // THEN: Should return 404 Not Found
        expect(response.status()).toBe(404)
      })

      await test.step('Setup: Add members to organization', async () => {
        const member1Response = await signUp({
          email: 'member1@example.com',
          password: 'Pass123!',
          name: 'Member 1',
        })
        const { member: m1 } = await addMember({
          organizationId: organization.id,
          userId: member1Response.user.id,
          role: 'member',
        })
        member1UserId = m1.userId

        const member2Response = await signUp({
          email: 'member2@example.com',
          password: 'Pass123!',
          name: 'Member 2',
        })
        const { member: m2 } = await addMember({
          organizationId: organization.id,
          userId: member2Response.user.id,
          role: 'member',
        })
        member2UserId = m2.userId
      })

      await test.step('API-AUTH-ORG-TEAMS-REMOVE-MEMBER-003: Returns 400 when user is not team member', async () => {
        // WHEN: Owner tries to remove member that's not in team
        const response = await page.request.delete('/api/auth/organization/remove-team-member', {
          data: { teamId, userId: member1UserId },
        })

        // THEN: Should return 400 Bad Request
        expect(response.status()).toBe(400)
        const error = await response.json()
        expect(error.message).toContain('member')
      })

      await test.step('Setup: Add members to team', async () => {
        await page.request.post('/api/auth/organization/add-team-member', {
          data: { teamId, userId: member1UserId },
        })
        await page.request.post('/api/auth/organization/add-team-member', {
          data: { teamId, userId: member2UserId },
        })
      })

      await test.step('API-AUTH-ORG-TEAMS-REMOVE-MEMBER-001: Returns 200 OK when owner removes member from team', async () => {
        // WHEN: Owner removes member from team
        const response = await page.request.delete('/api/auth/organization/remove-team-member', {
          data: { teamId, userId: member1UserId },
        })

        // THEN: Returns 200 OK
        expect(response.status()).toBe(200)

        // Verify member removed
        const listResponse = await page.request.get(
          `/api/auth/organization/list-team-members?teamId=${teamId}`
        )
        expect(listResponse.status()).toBe(200)
        const members = await listResponse.json()
        expect(members.length).toBe(1)
        expect(members[0].userId).toBe(member2UserId)
      })

      await test.step('Setup: Re-add member1 for permission test', async () => {
        await page.request.post('/api/auth/organization/add-team-member', {
          data: { teamId, userId: member1UserId },
        })
      })

      await test.step('API-AUTH-ORG-TEAMS-REMOVE-MEMBER-002: Returns 403 when non-owner tries to remove member', async () => {
        // Switch to member1 context
        await page.goto('/login')
        await page.fill('input[name="email"]', 'member1@example.com')
        await page.fill('input[name="password"]', 'Pass123!')
        await page.click('button[type="submit"]')

        // WHEN: Non-owner (member1) tries to remove member2 from team
        const response = await page.request.delete('/api/auth/organization/remove-team-member', {
          data: { teamId, userId: member2UserId },
        })

        // THEN: Should return 403 Forbidden
        expect(response.status()).toBe(403)
      })
    }
  )
})
