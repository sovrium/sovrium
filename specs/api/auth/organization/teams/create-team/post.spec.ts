/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test } from '@/specs/fixtures'

/**
 * E2E Tests for Create Team within Organization
 *
 * Domain: api
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('Create Team', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-TEAMS-CREATE-001: should return 201 Created with team data when owner creates team',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: An authenticated user who owns an organization
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

      // WHEN: Owner creates a team within the organization
      const response = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Engineering Team',
          description: 'Product engineering team',
          metadata: { department: 'engineering' },
        },
      })

      // THEN: Returns 201 Created with team data
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name', 'Engineering Team')
      expect(data).toHaveProperty('description', 'Product engineering team')
      expect(data).toHaveProperty('organizationId', organization.id)
      expect(data).toHaveProperty('metadata', { department: 'engineering' })
      expect(data).toHaveProperty('createdAt')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-CREATE-002: should return 201 Created with minimal data (name only)',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: An authenticated organization owner
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

      // WHEN: Owner creates team with only required name field
      const response = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Marketing Team',
        },
      })

      // THEN: Returns 201 Created with team data (description and metadata are optional)
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name', 'Marketing Team')
      expect(data).toHaveProperty('organizationId', organization.id)
      expect(data.description).toBeUndefined()
      expect(data.metadata).toBeUndefined()
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-CREATE-003: should return 403 Forbidden when non-owner tries to create team',
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
      // GIVEN: Organization with owner and a regular member
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

      // WHEN: Member tries to create a team
      const response = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Unauthorized Team',
        },
      })

      // THEN: Returns 403 Forbidden (only owner/admin can create teams)
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('permission')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-CREATE-004: should return 400 Bad Request when team name is missing',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: An authenticated organization owner
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

      // WHEN: Owner tries to create team without name
      const response = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          description: 'Team without name',
        },
      })

      // THEN: Returns 400 Bad Request (name is required)
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('name')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-CREATE-005: should return 409 Conflict when team name already exists in organization',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: Organization with an existing team
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
        },
      })

      // WHEN: Owner tries to create another team with same name
      const response = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Engineering Team',
        },
      })

      // THEN: Returns 409 Conflict (team names must be unique within organization)
      expect(response.status()).toBe(409)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('already exists')
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-CREATE-006: should return 401 Unauthorized when user is not authenticated',
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

      // WHEN: Unauthenticated user tries to create team
      const response = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: 'org-123',
          name: 'Engineering Team',
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
    'API-AUTH-ORG-TEAMS-CREATE-007: owner can complete full team creation workflow with metadata',
    { tag: '@regression' },
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

      const { organization } = await createOrganization({
        name: 'Test Company',
        slug: 'test-company',
      })

      // WHEN: Owner creates multiple teams with different configurations
      const engineeringResponse = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Engineering Team',
          description: 'Product engineering',
          metadata: { department: 'engineering', size: 'large' },
        },
      })

      const marketingResponse = await page.request.post('/api/auth/organization/create-team', {
        data: {
          organizationId: organization.id,
          name: 'Marketing Team',
        },
      })

      // THEN: Both teams created successfully with correct data
      expect(engineeringResponse.status()).toBe(201)
      expect(marketingResponse.status()).toBe(201)

      const engTeam = await engineeringResponse.json()
      const mktTeam = await marketingResponse.json()

      expect(engTeam.name).toBe('Engineering Team')
      expect(engTeam.metadata).toEqual({ department: 'engineering', size: 'large' })

      expect(mktTeam.name).toBe('Marketing Team')
      expect(mktTeam.description).toBeUndefined()
    }
  )
})
