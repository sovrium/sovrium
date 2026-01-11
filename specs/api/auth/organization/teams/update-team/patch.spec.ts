/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Update Team
 *
 * Domain: api
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('Update Team', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-TEAMS-UPDATE-001: should return 200 OK with updated team data when owner updates team',
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

      // WHEN: Owner updates team details
      const response = await page.request.patch('/api/auth/organization/update-team', {
        data: {
          teamId,
          name: 'Product Engineering Team',
        },
      })

      // THEN: Returns 200 OK with updated data
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('id', teamId)
      expect(data).toHaveProperty('name', 'Product Engineering Team')
      expect(data).toHaveProperty('organizationId', organization.id)
      expect(data).toHaveProperty('updatedAt')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-UPDATE-002: should return 200 OK when updating only name',
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
          name: 'Original Name',
        },
      })

      const { id: teamId } = await createResponse.json()

      // WHEN: Owner updates only team name
      const response = await page.request.patch('/api/auth/organization/update-team', {
        data: {
          teamId,
          name: 'Updated Name',
        },
      })

      // THEN: Returns 200 OK with updated name
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('name', 'Updated Name')
      expect(data).toHaveProperty('organizationId', organization.id)
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-UPDATE-003: should return 403 Forbidden when non-owner tries to update team',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      signUp,
      createOrganization,
      inviteMember,
      acceptInvitation,
      page,
    }) => {
      // GIVEN: Organization with team, owner, and member
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
          name: 'Team',
        },
      })

      const { id: teamId } = await createResponse.json()

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

      await acceptInvitation(invitation.id)

      // WHEN: Member tries to update team
      const response = await page.request.patch('/api/auth/organization/update-team', {
        data: {
          teamId,
          name: 'Unauthorized Update',
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
    'API-AUTH-ORG-TEAMS-UPDATE-004: should return 409 Conflict when updated name already exists',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: Organization with two teams
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

      // Create team 1
      await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Engineering Team',
        },
      })

      // Create team 2
      const team2Response = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Marketing Team',
        },
      })

      const { id: team2Id } = await team2Response.json()

      // WHEN: Owner tries to rename team 2 to existing name
      const response = await page.request.patch('/api/auth/organization/update-team', {
        data: {
          teamId: team2Id,
          name: 'Engineering Team',
        },
      })

      // THEN: Returns 409 Conflict
      expect(response.status()).toBe(409)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('already exists')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-UPDATE-005: should return 404 Not Found when team does not exist',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: Organization without the team
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

      // WHEN: Owner tries to update non-existent team
      const response = await page.request.patch('/api/auth/organization/update-team', {
        data: {
          teamId: 'non-existent-team-id',
          name: 'Updated Name',
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
    'API-AUTH-ORG-TEAMS-UPDATE-006: should return 401 Unauthorized when user is not authenticated',
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

      // WHEN: Unauthenticated user tries to update team
      const response = await page.request.patch('/api/auth/organization/update-team', {
        data: {
          teamId: 'team-123',
          name: 'Updated Name',
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
    'API-AUTH-ORG-TEAMS-UPDATE-REGRESSION: owner can complete full team update workflow',
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
      let team2Id: string

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

      await test.step('API-AUTH-ORG-TEAMS-UPDATE-006: Returns 401 Unauthorized when not authenticated', async () => {
        // WHEN: Unauthenticated user tries to update team
        const response = await page.request.patch('/api/auth/organization/update-team', {
          data: {
            teamId: 'team-123',
            name: 'Updated Name',
          },
        })

        // THEN: Returns 401 Unauthorized
        expect(response.status()).toBe(401)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('Unauthorized')
      })

      await test.step('Setup: Create owner and organization with teams', async () => {
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

        // Create first team
        const createResponse = await page.request.post('/api/auth/organization/create-team', {
          data: {
            organizationId: organization.id,
            name: 'Engineering Team',
          },
        })
        const team = await createResponse.json()
        teamId = team.id

        // Create second team for conflict testing
        const create2Response = await page.request.post('/api/auth/organization/create-team', {
          data: {
            organizationId: organization.id,
            name: 'Marketing Team',
          },
        })
        const team2 = await create2Response.json()
        team2Id = team2.id
      })

      await test.step('API-AUTH-ORG-TEAMS-UPDATE-005: Returns 404 Not Found when team does not exist', async () => {
        // WHEN: Owner tries to update non-existent team
        const response = await page.request.patch('/api/auth/organization/update-team', {
          data: {
            teamId: 'non-existent-team-id',
            name: 'Updated Name',
          },
        })

        // THEN: Returns 404 Not Found
        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('not found')
      })

      await test.step('API-AUTH-ORG-TEAMS-UPDATE-001: Returns 200 OK with updated team data when owner updates team', async () => {
        // WHEN: Owner updates team details
        const response = await page.request.patch('/api/auth/organization/update-team', {
          data: {
            teamId,
            name: 'Product Engineering Team',
          },
        })

        // THEN: Returns 200 OK with updated data
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('id', teamId)
        expect(data).toHaveProperty('name', 'Product Engineering Team')
        expect(data).toHaveProperty('organizationId', organization.id)
        expect(data).toHaveProperty('updatedAt')
      })

      await test.step('API-AUTH-ORG-TEAMS-UPDATE-002: Returns 200 OK when updating only name', async () => {
        // WHEN: Owner updates only team name
        const response = await page.request.patch('/api/auth/organization/update-team', {
          data: {
            teamId,
            name: 'Updated Engineering Team',
          },
        })

        // THEN: Returns 200 OK with updated name
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('name', 'Updated Engineering Team')
        expect(data).toHaveProperty('organizationId', organization.id)
      })

      await test.step('API-AUTH-ORG-TEAMS-UPDATE-004: Returns 409 Conflict when updated name already exists', async () => {
        // WHEN: Owner tries to rename team 2 to existing name
        const response = await page.request.patch('/api/auth/organization/update-team', {
          data: {
            teamId: team2Id,
            name: 'Updated Engineering Team', // Same as team 1
          },
        })

        // THEN: Returns 409 Conflict
        expect(response.status()).toBe(409)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('already exists')
      })

      await test.step('Setup: Create member user for permission test', async () => {
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

        await acceptInvitation(invitation.id)
      })

      await test.step('API-AUTH-ORG-TEAMS-UPDATE-003: Returns 403 Forbidden when non-owner tries to update team', async () => {
        // WHEN: Member tries to update team
        const response = await page.request.patch('/api/auth/organization/update-team', {
          data: {
            teamId,
            name: 'Unauthorized Update',
          },
        })

        // THEN: Returns 403 Forbidden
        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('permission')
      })
    }
  )
})
