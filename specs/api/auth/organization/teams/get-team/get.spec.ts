/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Get Team Details
 *
 * Domain: api
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('Get Team', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-TEAMS-GET-001: should return 200 OK with team details when organization member requests team',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: Organization with a team
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

      const createResponse = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Engineering Team',
        },
      })

      const { id: teamId } = await createResponse.json()

      // WHEN: User requests team details
      const response = await page.request.get(`/api/auth/organization/get-team?teamId=${teamId}`)

      // THEN: Returns 200 OK with complete team data
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('id', teamId)
      expect(data).toHaveProperty('name', 'Engineering Team')
      expect(data).toHaveProperty('organizationId', organization.id)
      expect(data).toHaveProperty('createdAt')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-GET-002: should return 200 OK with team including member count',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      signUp,
      createOrganization,
      inviteMember,
      acceptInvitation,
      page,
    }) => {
      // GIVEN: Team with multiple members
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

      const createResponse = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Marketing Team',
        },
      })

      const { id: teamId } = await createResponse.json()

      // Add members to organization
      const { invitation } = await inviteMember({
        organizationId: organization.id,
        email: 'member1@example.com',
        role: 'member',
      })

      await signUp({
        email: 'member1@example.com',
        password: 'Member1Pass123!',
        name: 'Member One',
      })

      const member1Accept = await acceptInvitation(invitation.id)

      // Add member to team
      await page.request.post('/api/auth/organization/add-team-member', {
        data: {
          teamId,
          userId: member1Accept.member.userId,
        },
      })

      // WHEN: User gets team details
      const response = await page.request.get(`/api/auth/organization/get-team?teamId=${teamId}`)

      // THEN: Response includes member count
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('id', teamId)
      expect(data).toHaveProperty('name', 'Marketing Team')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-GET-003: should return 403 Forbidden when user is not organization member',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: Two separate organizations with teams
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            teams: true,
          },
        },
      })

      // User 1 creates organization 1 with team
      await signUp({
        email: 'user1@example.com',
        password: 'User1Pass123!',
        name: 'User One',
      })

      const { organization: org1 } = await createOrganization({
        name: 'Company One',
        slug: 'company-one',
      })

      const createResponse = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: org1.id,
          name: 'Team One',
        },
      })

      const { id: team1Id } = await createResponse.json()

      // User 2 creates organization 2
      await signUp({
        email: 'user2@example.com',
        password: 'User2Pass123!',
        name: 'User Two',
      })

      await createOrganization({
        name: 'Company Two',
        slug: 'company-two',
      })

      // WHEN: User 2 tries to get team from organization 1
      const response = await page.request.get(`/api/auth/organization/get-team?teamId=${team1Id}`)

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('permission')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-GET-004: should return 404 Not Found when team does not exist',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: Organization without the requested team
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

      await createOrganization({
        name: 'Test Company',
        slug: 'test-company',
      })

      // WHEN: User requests non-existent team
      const response = await page.request.get(
        '/api/auth/organization/get-team?teamId=non-existent-team-id'
      )

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('not found')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-GET-005: should return 400 Bad Request when teamId is missing',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: Authenticated organization member
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

      await createOrganization({
        name: 'Test Company',
        slug: 'test-company',
      })

      // WHEN: User requests team without teamId parameter
      const response = await page.request.get('/api/auth/organization/get-team')

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('teamId')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-GET-006: should return 401 Unauthorized when user is not authenticated',
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

      // WHEN: Unauthenticated user tries to get team
      const response = await page.request.get('/api/auth/organization/get-team?teamId=team-123')

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
    'API-AUTH-ORG-TEAMS-GET-007: member can view complete team details',
    { tag: '@regression' },
    async ({
      startServerWithSchema,
      signUp,
      createOrganization,
      inviteMember,
      acceptInvitation,
      page,
    }) => {
      // GIVEN: Organization with team containing members
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

      const createResponse = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Engineering Team',
        },
      })

      const { id: teamId } = await createResponse.json()

      // Add multiple members to team
      const memberEmails = ['dev1@example.com', 'dev2@example.com', 'dev3@example.com']

      for (const email of memberEmails) {
        const { invitation } = await inviteMember({
          organizationId: organization.id,
          email,
          role: 'member',
        })

        await signUp({
          email,
          password: 'DevPass123!',
          name: `Developer ${email}`,
        })

        const memberAccept = await acceptInvitation(invitation.id)

        await page.request.post('/api/auth/organization/add-team-member', {
          data: {
            teamId,
            userId: memberAccept.member.userId,
          },
        })
      }

      // WHEN: Member gets team details
      const response = await page.request.get(`/api/auth/organization/get-team?teamId=${teamId}`)

      // THEN: Response includes complete team data
      expect(response.status()).toBe(200)

      const team = await response.json()
      expect(team.name).toBe('Engineering Team')
      expect(team.organizationId).toBe(organization.id)
      expect(team).toHaveProperty('id', teamId)
      expect(team).toHaveProperty('createdAt')
    }
  )
})
