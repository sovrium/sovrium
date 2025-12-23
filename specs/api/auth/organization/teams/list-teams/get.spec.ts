/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test } from '@/specs/fixtures'

/**
 * E2E Tests for List Teams in Organization
 *
 * Domain: api
 * Spec Count: 7
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

      // Create multiple teams
      await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Engineering Team',
          description: 'Product engineering',
        },
      })

      await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Marketing Team',
          description: 'Marketing and growth',
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
      expect(data[0]).toHaveProperty('description')
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
          plugins: { organization: true },
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
    'API-AUTH-ORG-TEAMS-LIST-004: should return teams with metadata when present',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: Organization with team containing metadata
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

      await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Engineering Team',
          metadata: { department: 'engineering', size: 'large' },
        },
      })

      // WHEN: User lists teams
      const response = await page.request.get(
        `/api/auth/organization/list-teams?organizationId=${organization.id}`
      )

      // THEN: Teams include metadata
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data[0]).toHaveProperty('metadata')
      expect(data[0].metadata).toEqual({ department: 'engineering', size: 'large' })
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
          plugins: { organization: true },
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
          plugins: { organization: true },
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
    'API-AUTH-ORG-TEAMS-LIST-007: member can view all organization teams with metadata',
    { tag: '@regression' },
    async ({
      startServerWithSchema,
      signUp,
      createOrganization,
      inviteMember,
      acceptInvitation,
      page,
    }) => {
      // GIVEN: Organization with multiple teams and a member
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

      // Create teams with varying metadata
      await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Engineering',
          metadata: { department: 'eng', budget: 50_000 },
        },
      })

      await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Marketing',
        },
      })

      // Invite and accept member
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

      // WHEN: Member lists teams
      const response = await page.request.get(
        `/api/auth/organization/list-teams?organizationId=${organization.id}`
      )

      // THEN: Member sees all teams with metadata
      expect(response.status()).toBe(200)

      const teams = await response.json()
      expect(teams).toHaveLength(2)

      const engineering = teams.find((t: { name: string }) => t.name === 'Engineering')
      expect(engineering.metadata).toEqual({ department: 'eng', budget: 50_000 })

      const marketing = teams.find((t: { name: string }) => t.name === 'Marketing')
      expect(marketing.metadata).toBeUndefined()
    }
  )
})
