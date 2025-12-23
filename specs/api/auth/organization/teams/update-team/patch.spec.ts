/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test } from '@/specs/fixtures'

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
          description: 'Original description',
          metadata: { department: 'engineering' },
        },
      })

      const { id: teamId } = await createResponse.json()

      // WHEN: Owner updates team details
      const response = await page.request.patch('/api/auth/organization/update-team', {
        data: {
          teamId,
          name: 'Product Engineering Team',
          description: 'Updated description for product development',
          metadata: { department: 'engineering', size: 'large', budget: 75_000 },
        },
      })

      // THEN: Returns 200 OK with updated data
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('id', teamId)
      expect(data).toHaveProperty('name', 'Product Engineering Team')
      expect(data).toHaveProperty('description', 'Updated description for product development')
      expect(data).toHaveProperty('metadata', {
        department: 'engineering',
        size: 'large',
        budget: 75_000,
      })
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
          name: 'Original Name',
          description: 'Original description',
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

      // THEN: Returns 200 OK with updated name, other fields unchanged
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('name', 'Updated Name')
      expect(data).toHaveProperty('description', 'Original description')
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
          name: 'Team',
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
          plugins: { organization: true },
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
    'API-AUTH-ORG-TEAMS-UPDATE-007: owner can update all team fields and verify changes persist',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: Organization with team
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
          name: 'Original Team',
          description: 'Original description',
          metadata: { version: 1 },
        },
      })

      const { id: teamId } = await createResponse.json()

      // WHEN: Owner performs multiple updates
      // First update: name and description
      const update1Response = await page.request.patch('/api/auth/organization/update-team', {
        data: {
          teamId,
          name: 'Updated Team v1',
          description: 'First update',
        },
      })

      expect(update1Response.status()).toBe(200)

      // Second update: metadata
      const update2Response = await page.request.patch('/api/auth/organization/update-team', {
        data: {
          teamId,
          metadata: { version: 2, features: ['chat', 'video'], active: true },
        },
      })

      expect(update2Response.status()).toBe(200)

      // Third update: all fields
      const update3Response = await page.request.patch('/api/auth/organization/update-team', {
        data: {
          teamId,
          name: 'Final Team Name',
          description: 'Final description',
          metadata: { version: 3, status: 'production' },
        },
      })

      expect(update3Response.status()).toBe(200)

      // THEN: Get team to verify final state
      const getResponse = await page.request.get(`/api/auth/organization/get-team?teamId=${teamId}`)
      const finalTeam = await getResponse.json()

      expect(finalTeam.name).toBe('Final Team Name')
      expect(finalTeam.description).toBe('Final description')
      expect(finalTeam.metadata).toEqual({ version: 3, status: 'production' })
    }
  )
})
