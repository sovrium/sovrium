/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test } from '@/specs/fixtures'

/**
 * E2E Tests for Delete Team
 *
 * Domain: api
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('Delete Team', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-TEAMS-DELETE-001: should return 200 OK when owner deletes team',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: Organization with a team
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

      const { organization } = await createOrganization({
        name: 'Test Company',
        slug: 'test-company',
      })

      const createResponse = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Engineering Team',
        },
      })

      const { id: teamId } = await createResponse.json()

      // WHEN: Owner deletes the team
      const response = await page.request.delete('/api/auth/organization/delete-team', {
        data: {
          teamId,
        },
      })

      // THEN: Returns 200 OK
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('success', true)

      // THEN: Team no longer exists
      const getResponse = await page.request.get(`/api/auth/organization/get-team?teamId=${teamId}`)
      expect(getResponse.status()).toBe(404)
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-DELETE-002: should cascade delete team members when team is deleted',
    { tag: '@spec' },
    async ({
      // GIVEN: TODO: Describe preconditions
      // WHEN: TODO: Describe action
      // THEN: TODO: Describe expected outcome
      startServerWithSchema,
      signUp,
      createOrganization,
      inviteMember,
      acceptInvitation,
      page,
    }) => {
      // GIVEN: Team with members
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

      const { organization } = await createOrganization({
        name: 'Test Company',
        slug: 'test-company',
      })

      const createResponse = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Team to Delete',
        },
      })

      const { id: teamId } = await createResponse.json()

      // Add member to team
      await inviteMember({
        organizationId: organization.id,
        email: 'member@example.com',
        role: 'member',
      })

      await signUp({
        email: 'member@example.com',
        password: 'MemberPass123!',
        name: 'Member User',
      })

      const memberAccept = await acceptInvitation({
        organizationId: organization.id,
        email: 'member@example.com',
      })

      await page.request.post('/api/auth/organization/add-team-member', {
        data: {
          teamId,
          userId: memberAccept.member.userId,
        },
      })

      // WHEN: Owner deletes team
      const response = await page.request.delete('/api/auth/organization/delete-team', {
        data: {
          teamId,
        },
      })

      // THEN: Team and team members deleted
      expect(response.status()).toBe(200)

      const listMembersResponse = await page.request.get(
        `/api/auth/organization/list-team-members?teamId=${teamId}`
      )
      expect(listMembersResponse.status()).toBe(404)
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-DELETE-003: should return 403 Forbidden when non-owner tries to delete team',
    { tag: '@spec' },
    async ({
      // GIVEN: TODO: Describe preconditions
      // WHEN: TODO: Describe action
      // THEN: TODO: Describe expected outcome
      startServerWithSchema,
      signUp,
      createOrganization,
      inviteMember,
      acceptInvitation,
      page,
    }) => {
      // GIVEN: Organization with team and member
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

      const { organization } = await createOrganization({
        name: 'Test Company',
        slug: 'test-company',
      })

      const createResponse = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Protected Team',
        },
      })

      const { id: teamId } = await createResponse.json()

      await inviteMember({
        organizationId: organization.id,
        email: 'member@example.com',
        role: 'member',
      })

      await signUp({
        email: 'member@example.com',
        password: 'MemberPass123!',
        name: 'Member User',
      })

      await acceptInvitation({
        organizationId: organization.id,
        email: 'member@example.com',
      })

      // WHEN: Member tries to delete team
      const response = await page.request.delete('/api/auth/organization/delete-team', {
        data: {
          teamId,
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('permission')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-DELETE-004: should return 404 Not Found when team does not exist',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: Organization without the team
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

      await createOrganization({
        name: 'Test Company',
        slug: 'test-company',
      })

      // WHEN: Owner tries to delete non-existent team
      const response = await page.request.delete('/api/auth/organization/delete-team', {
        data: {
          teamId: 'non-existent-team-id',
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
    'API-AUTH-ORG-TEAMS-DELETE-005: should return 400 Bad Request when teamId is missing',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: Authenticated organization owner
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

      await createOrganization({
        name: 'Test Company',
        slug: 'test-company',
      })

      // WHEN: Owner tries to delete team without teamId
      const response = await page.request.delete('/api/auth/organization/delete-team', {
        data: {},
      })

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('teamId')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-DELETE-006: should return 401 Unauthorized when user is not authenticated',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: Server running without authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      // WHEN: Unauthenticated user tries to delete team
      const response = await page.request.delete('/api/auth/organization/delete-team', {
        data: {
          teamId: 'team-123',
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
    'API-AUTH-ORG-TEAMS-DELETE-007: owner can delete team with members and verify cleanup',
    { tag: '@regression' },
    async ({
      startServerWithSchema,
      signUp,
      createOrganization,
      inviteMember,
      acceptInvitation,
      page,
    }) => {
      // GIVEN: Organization with multiple teams, some with members
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

      const { organization } = await createOrganization({
        name: 'Test Company',
        slug: 'test-company',
      })

      // Create team 1 with members
      const team1Response = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Team to Delete',
          metadata: { temporary: true },
        },
      })

      const { id: team1Id } = await team1Response.json()

      // Create team 2 (will remain)
      const team2Response = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Team to Keep',
        },
      })

      const { id: team2Id } = await team2Response.json()

      // Add members to both teams
      for (let i = 1; i <= 2; i++) {
        const email = `member${i}@example.com`

        await inviteMember({
          organizationId: organization.id,
          email,
          role: 'member',
        })

        await signUp({
          email,
          password: 'MemberPass123!',
          name: `Member ${i}`,
        })

        const memberAccept = await acceptInvitation({
          organizationId: organization.id,
          email,
        })

        await page.request.post('/api/auth/organization/add-team-member', {
          data: {
            teamId: team1Id,
            userId: memberAccept.member.userId,
          },
        })

        await page.request.post('/api/auth/organization/add-team-member', {
          data: {
            teamId: team2Id,
            userId: memberAccept.member.userId,
          },
        })
      }

      // WHEN: Owner deletes team 1
      const deleteResponse = await page.request.delete('/api/auth/organization/delete-team', {
        data: {
          teamId: team1Id,
        },
      })

      expect(deleteResponse.status()).toBe(200)

      // THEN: Team 1 is deleted but team 2 still exists
      const getTeam1Response = await page.request.get(
        `/api/auth/organization/get-team?teamId=${team1Id}`
      )
      expect(getTeam1Response.status()).toBe(404)

      const getTeam2Response = await page.request.get(
        `/api/auth/organization/get-team?teamId=${team2Id}`
      )
      expect(getTeam2Response.status()).toBe(200)

      // THEN: List teams shows only team 2
      const listResponse = await page.request.get(
        `/api/auth/organization/list-teams?organizationId=${organization.id}`
      )
      const teams = await listResponse.json()
      expect(teams).toHaveLength(1)
      expect(teams[0].id).toBe(team2Id)
    }
  )
})
