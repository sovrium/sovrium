/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for List Teams in Organization
 *
 * Domain: api
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('List Teams', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-TEAMS-LIST-001: should return 200 OK with array of teams for organization member',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: Organization with multiple teams
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

      // Create multiple teams
      await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Engineering Team',
        },
      })

      await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Marketing Team',
        },
      })

      // WHEN: User requests list of teams
      const response = await page.request.get(
        `/api/auth/organization/list-teams?organizationId=${organization.id}`
      )

      // THEN: Returns 200 OK with array of teams
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(2)

      expect(data[0]).toHaveProperty('id')
      expect(data[0]).toHaveProperty('name')
      expect(data[0]).toHaveProperty('organizationId', organization.id)

      const teamNames = data.map((team: { name: string }) => team.name)
      expect(teamNames).toContain('Engineering Team')
      expect(teamNames).toContain('Marketing Team')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-LIST-002: should return 200 OK with empty array when organization has no teams',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: Organization without teams
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

      // WHEN: User requests list of teams
      const response = await page.request.get(
        `/api/auth/organization/list-teams?organizationId=${organization.id}`
      )

      // THEN: Returns 200 OK with empty array
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(0)
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-LIST-003: should return 403 Forbidden when user is not organization member',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: Two separate organizations
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            teams: true,
          },
        },
      })

      // User 1 creates organization 1
      await signUp({
        email: 'user1@example.com',
        password: 'User1Pass123!',
        name: 'User One',
      })

      const { organization: org1 } = await createOrganization({
        name: 'Company One',
        slug: 'company-one',
      })

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

      // WHEN: User 2 tries to list teams from organization 1
      const response = await page.request.get(
        `/api/auth/organization/list-teams?organizationId=${org1.id}`
      )

      // THEN: Returns 403 Forbidden (user not a member)
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('permission')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-LIST-004: should return teams with createdAt timestamp',
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

      await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Engineering Team',
        },
      })

      // WHEN: User lists teams
      const response = await page.request.get(
        `/api/auth/organization/list-teams?organizationId=${organization.id}`
      )

      // THEN: Teams include createdAt timestamp
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data[0]).toHaveProperty('createdAt')
      expect(new Date(data[0].createdAt)).toBeInstanceOf(Date)
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-LIST-005: should return 400 Bad Request when organizationId is missing',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Authenticated user
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
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })

      // WHEN: User tries to list teams without organizationId
      const response = await page.request.get('/api/auth/organization/list-teams')

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('organizationId')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-LIST-006: should return 401 Unauthorized when user is not authenticated',
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

      // WHEN: Unauthenticated user tries to list teams
      const response = await page.request.get(
        '/api/auth/organization/list-teams?organizationId=org-123'
      )

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
    'API-AUTH-ORG-TEAMS-LIST-REGRESSION: member can view all organization teams',
    { tag: '@regression' },
    async ({
      startServerWithSchema,
      signUp,
      createOrganization,
      inviteMember: _inviteMember,
      acceptInvitation: _acceptInvitation,
      page,
    }) => {
      let organization: { id: string }
      let org1: { id: string }

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

      await test.step('API-AUTH-ORG-TEAMS-LIST-006: Returns 401 Unauthorized when not authenticated', async () => {
        // WHEN: Unauthenticated user tries to list teams
        const response = await page.request.get(
          '/api/auth/organization/list-teams?organizationId=org-123'
        )

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

        // Create multiple teams
        await page.request.post('/api/auth/organization/create-team', {
          data: {
            organizationId: organization.id,
            name: 'Engineering Team',
          },
        })

        await page.request.post('/api/auth/organization/create-team', {
          data: {
            organizationId: organization.id,
            name: 'Marketing Team',
          },
        })
      })

      await test.step('API-AUTH-ORG-TEAMS-LIST-005: Returns 400 Bad Request when organizationId is missing', async () => {
        // WHEN: User tries to list teams without organizationId
        const response = await page.request.get('/api/auth/organization/list-teams')

        // THEN: Returns 400 Bad Request
        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('organizationId')
      })

      await test.step('API-AUTH-ORG-TEAMS-LIST-001: Returns 200 OK with array of teams for organization member', async () => {
        // WHEN: User requests list of teams
        const response = await page.request.get(
          `/api/auth/organization/list-teams?organizationId=${organization.id}`
        )

        // THEN: Returns 200 OK with array of teams
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(Array.isArray(data)).toBe(true)
        expect(data).toHaveLength(2)

        expect(data[0]).toHaveProperty('id')
        expect(data[0]).toHaveProperty('name')
        expect(data[0]).toHaveProperty('organizationId', organization.id)

        const teamNames = data.map((team: { name: string }) => team.name)
        expect(teamNames).toContain('Engineering Team')
        expect(teamNames).toContain('Marketing Team')
      })

      await test.step('API-AUTH-ORG-TEAMS-LIST-004: Returns teams with createdAt timestamp', async () => {
        // WHEN: User lists teams
        const response = await page.request.get(
          `/api/auth/organization/list-teams?organizationId=${organization.id}`
        )

        // THEN: Teams include createdAt timestamp
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data[0]).toHaveProperty('createdAt')
        expect(new Date(data[0].createdAt)).toBeInstanceOf(Date)
      })

      await test.step('Setup: Create second organization for permission test', async () => {
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
        org1 = organization // Save org1 reference before switching
      })

      await test.step('API-AUTH-ORG-TEAMS-LIST-003: Returns 403 Forbidden when user is not organization member', async () => {
        // WHEN: User 2 tries to list teams from organization 1
        const response = await page.request.get(
          `/api/auth/organization/list-teams?organizationId=${org1.id}`
        )

        // THEN: Returns 403 Forbidden (user not a member)
        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('permission')
      })

      await test.step('Setup: Create member user for empty list test', async () => {
        await signUp({
          email: 'owner3@example.com',
          password: 'Owner3Pass123!',
          name: 'Owner Three',
        })

        const result = await createOrganization({
          name: 'Empty Company',
          slug: 'empty-company',
        })
        organization = result.organization
      })

      await test.step('API-AUTH-ORG-TEAMS-LIST-002: Returns 200 OK with empty array when organization has no teams', async () => {
        // WHEN: User requests list of teams from organization without teams
        const response = await page.request.get(
          `/api/auth/organization/list-teams?organizationId=${organization.id}`
        )

        // THEN: Returns 200 OK with empty array
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(Array.isArray(data)).toBe(true)
        expect(data).toHaveLength(0)
      })
    }
  )
})
