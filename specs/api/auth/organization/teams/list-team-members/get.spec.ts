/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for List Team Members
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('List Team Members', () => {
  test.fixme(
    'API-AUTH-ORG-TEAMS-LIST-MEMBERS-001: should return 200 OK with array of team members',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: Team with members
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

      // WHEN: User lists team members
      const response = await page.request.get(
        `/api/auth/organization/list-team-members?teamId=${teamId}`
      )

      // THEN: Returns 200 OK with members array
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-LIST-MEMBERS-002: should return empty array when team has no members',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
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
      await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })
      const { organization } = await createOrganization({ name: 'Company', slug: 'company' })

      const teamResponse = await page.request.post('/api/auth/organization/create-team', {
        data: { organizationId: organization.id, name: 'Empty Team' },
      })
      const { id: teamId } = await teamResponse.json()

      // WHEN: User lists team members
      const response = await page.request.get(
        `/api/auth/organization/list-team-members?teamId=${teamId}`
      )

      // THEN: Returns 200 OK with empty array
      expect(response.status()).toBe(200)
      const members = await response.json()
      expect(Array.isArray(members)).toBe(true)
      expect(members.length).toBe(0)
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-LIST-MEMBERS-003: should return 403 when user not in organization',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: Two separate users with different organizations
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            teams: true,
          },
        },
      })
      await signUp({ email: 'owner1@example.com', password: 'Pass123!', name: 'Owner 1' })
      const { organization: org1 } = await createOrganization({
        name: 'Company 1',
        slug: 'company-1',
      })

      const teamResponse = await page.request.post('/api/auth/organization/create-team', {
        data: { organizationId: org1.id, name: 'Engineering' },
      })
      const { id: teamId } = await teamResponse.json()

      // Switch to different user
      await signUp({ email: 'owner2@example.com', password: 'Pass123!', name: 'Owner 2' })
      await createOrganization({ name: 'Company 2', slug: 'company-2' })

      // WHEN: User from different org tries to list team members
      const response = await page.request.get(
        `/api/auth/organization/list-team-members?teamId=${teamId}`
      )

      // THEN: Should return 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-LIST-MEMBERS-004: should return 404 when team does not exist',
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

      // WHEN: User tries to list members of non-existent team
      const response = await page.request.get(
        '/api/auth/organization/list-team-members?teamId=non-existent-team-id'
      )

      // THEN: Should return 404 Not Found
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-LIST-MEMBERS-005: should return 400 when teamId missing',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: User with organization
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

      // WHEN: User tries to list team members without teamId
      const response = await page.request.get('/api/auth/organization/list-team-members')

      // THEN: Should return 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('teamId')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-LIST-MEMBERS-006: should return 401 when not authenticated',
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

      // WHEN: Unauthenticated request to list team members
      const response = await request.get(
        '/api/auth/organization/list-team-members?teamId=some-team-id'
      )

      // THEN: Should return 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )
  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-TEAMS-LIST-MEMBERS-REGRESSION: member can list team members with full workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp, createOrganization, addMember, page, request }) => {
      let organization: { id: string }
      let teamId: string
      let team1Id: string
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

      await test.step('API-AUTH-ORG-TEAMS-LIST-MEMBERS-006: Returns 401 when not authenticated', async () => {
        // WHEN: Unauthenticated request to list team members
        const response = await request.get(
          '/api/auth/organization/list-team-members?teamId=some-team-id'
        )

        // THEN: Should return 401 Unauthorized
        expect(response.status()).toBe(401)
      })

      await test.step('Setup: Create owner and organization with team', async () => {
        await signUp({
          email: 'owner@example.com',
          password: 'Pass123!',
          name: 'Owner',
        })

        const result = await createOrganization({
          name: 'Company',
          slug: 'company',
        })
        organization = result.organization

        const teamResponse = await page.request.post('/api/auth/organization/create-team', {
          data: {
            organizationId: organization.id,
            name: 'Engineering',
          },
        })

        const team = await teamResponse.json()
        teamId = team.id
      })

      await test.step('API-AUTH-ORG-TEAMS-LIST-MEMBERS-005: Returns 400 when teamId missing', async () => {
        // WHEN: User tries to list team members without teamId
        const response = await page.request.get('/api/auth/organization/list-team-members')

        // THEN: Should return 400 Bad Request
        expect(response.status()).toBe(400)
        const error = await response.json()
        expect(error.message).toContain('teamId')
      })

      await test.step('API-AUTH-ORG-TEAMS-LIST-MEMBERS-004: Returns 404 when team does not exist', async () => {
        // WHEN: User tries to list members of non-existent team
        const response = await page.request.get(
          '/api/auth/organization/list-team-members?teamId=non-existent-team-id'
        )

        // THEN: Should return 404 Not Found
        expect(response.status()).toBe(404)
      })

      await test.step('API-AUTH-ORG-TEAMS-LIST-MEMBERS-002: Returns empty array when team has no members', async () => {
        // WHEN: User lists team members
        const response = await page.request.get(
          `/api/auth/organization/list-team-members?teamId=${teamId}`
        )

        // THEN: Returns 200 OK with empty array
        expect(response.status()).toBe(200)
        const members = await response.json()
        expect(Array.isArray(members)).toBe(true)
        expect(members.length).toBe(0)
      })

      await test.step('Setup: Add members to organization and team', async () => {
        // Add member 1
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

        // Add member 1 to team
        await page.request.post('/api/auth/organization/add-team-member', {
          data: {
            teamId,
            userId: member1UserId,
          },
        })

        // Add member 2
        const member2Response = await signUp({
          email: 'member2@example.com',
          password: 'Pass123!',
          name: 'Member 2',
        })
        const { member: m2 } = await addMember({
          organizationId: organization.id,
          userId: member2Response.user.id,
          role: 'admin',
        })
        member2UserId = m2.userId

        // Add member 2 to team
        await page.request.post('/api/auth/organization/add-team-member', {
          data: {
            teamId,
            userId: member2UserId,
          },
        })
      })

      await test.step('API-AUTH-ORG-TEAMS-LIST-MEMBERS-001: Returns 200 OK with array of team members', async () => {
        // WHEN: User lists team members
        const response = await page.request.get(
          `/api/auth/organization/list-team-members?teamId=${teamId}`
        )

        // THEN: Returns 200 OK with members array
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(Array.isArray(data)).toBe(true)
        expect(data.length).toBe(2)

        // Verify member data includes user IDs
        const userIds = data.map((m: { userId: string }) => m.userId)
        expect(userIds).toContain(member1UserId)
        expect(userIds).toContain(member2UserId)
      })

      await test.step('Setup: Create second organization for permission test', async () => {
        // Save current team ID
        team1Id = teamId

        // User 2 creates organization 2
        await signUp({
          email: 'owner2@example.com',
          password: 'Pass123!',
          name: 'Owner 2',
        })

        await createOrganization({
          name: 'Company 2',
          slug: 'company-2',
        })
      })

      await test.step('API-AUTH-ORG-TEAMS-LIST-MEMBERS-003: Returns 403 when user not in organization', async () => {
        // WHEN: User from different org tries to list team members
        const response = await page.request.get(
          `/api/auth/organization/list-team-members?teamId=${team1Id}`
        )

        // THEN: Should return 403 Forbidden
        expect(response.status()).toBe(403)
      })
    }
  )
})
