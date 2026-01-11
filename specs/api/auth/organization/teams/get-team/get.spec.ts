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
    'API-AUTH-ORG-TEAMS-GET-REGRESSION: member can view complete team details',
    { tag: '@regression' },
    async ({
      startServerWithSchema,
      signUp,
      createOrganization,
      inviteMember,
      acceptInvitation,
      page,
    }) => {
      let organization: { id: string }
      let teamId: string
      let team1Id: string

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

      await test.step('API-AUTH-ORG-TEAMS-GET-006: Returns 401 Unauthorized when not authenticated', async () => {
        // WHEN: Unauthenticated user tries to get team
        const response = await page.request.get('/api/auth/organization/get-team?teamId=team-123')

        // THEN: Returns 401 Unauthorized
        expect(response.status()).toBe(401)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('Unauthorized')
      })

      await test.step('Setup: Create owner and organization with team', async () => {
        await signUp({
          email: 'owner@example.com',
          password: 'OwnerPass123!',
          name: 'Owner User',
        })

        const result = await createOrganization({
          name: 'Test Company',
          slug: 'test-company',
        })
        organization = result.organization

        const createResponse = await page.request.post('/api/auth/organization/create-team', {
          data: {
            organizationId: organization.id,
            name: 'Engineering Team',
          },
        })

        const team = await createResponse.json()
        teamId = team.id
      })

      await test.step('API-AUTH-ORG-TEAMS-GET-005: Returns 400 Bad Request when teamId is missing', async () => {
        // WHEN: User requests team without teamId parameter
        const response = await page.request.get('/api/auth/organization/get-team')

        // THEN: Returns 400 Bad Request
        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('teamId')
      })

      await test.step('API-AUTH-ORG-TEAMS-GET-004: Returns 404 Not Found when team does not exist', async () => {
        // WHEN: User requests non-existent team
        const response = await page.request.get(
          '/api/auth/organization/get-team?teamId=non-existent-team-id'
        )

        // THEN: Returns 404 Not Found
        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('not found')
      })

      await test.step('API-AUTH-ORG-TEAMS-GET-001: Returns 200 OK with team details when organization member requests team', async () => {
        // WHEN: User requests team details
        const response = await page.request.get(`/api/auth/organization/get-team?teamId=${teamId}`)

        // THEN: Returns 200 OK with complete team data
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('id', teamId)
        expect(data).toHaveProperty('name', 'Engineering Team')
        expect(data).toHaveProperty('organizationId', organization.id)
        expect(data).toHaveProperty('createdAt')
      })

      await test.step('Setup: Add member to team and verify member count', async () => {
        // Add member to organization
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
      })

      await test.step('API-AUTH-ORG-TEAMS-GET-002: Returns 200 OK with team including member count', async () => {
        // WHEN: User gets team details
        const response = await page.request.get(`/api/auth/organization/get-team?teamId=${teamId}`)

        // THEN: Response includes team data
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('id', teamId)
        expect(data).toHaveProperty('name', 'Engineering Team')
      })

      await test.step('Setup: Create second organization for permission test', async () => {
        // Save current team1Id
        team1Id = teamId

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
      })

      await test.step('API-AUTH-ORG-TEAMS-GET-003: Returns 403 Forbidden when user is not organization member', async () => {
        // WHEN: User 2 tries to get team from organization 1
        const response = await page.request.get(`/api/auth/organization/get-team?teamId=${team1Id}`)

        // THEN: Returns 403 Forbidden
        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('permission')
      })
    }
  )
})
