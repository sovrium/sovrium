/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test } from '@/specs/fixtures'

/**
 * E2E Tests for Get Active Team
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('Get Active Team', () => {
  test.fixme(
    'API-AUTH-ORG-TEAMS-GET-ACTIVE-001: should return 200 OK with active team details',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: User with active team set
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { organization: true } },
      })
      await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })
      const { organization } = await createOrganization({ name: 'Company', slug: 'company' })

      const teamResponse = await page.request.post('/api/auth/organization/create-team', {
        data: { organizationId: organization.id, name: 'Team' },
      })
      const { id: teamId } = await teamResponse.json()

      await page.request.post('/api/auth/organization/set-active-team', {
        data: { teamId },
      })

      // WHEN: User gets active team
      const response = await page.request.get('/api/auth/organization/get-active-team')

      // THEN: Returns 200 OK with team details
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('id', teamId)
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-GET-ACTIVE-002: should return null when no active team set',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: User with organization but no active team
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { organization: true } },
      })
      await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })
      await createOrganization({ name: 'Company', slug: 'company' })

      // WHEN: User gets active team
      const response = await page.request.get('/api/auth/organization/get-active-team')

      // THEN: Returns 200 OK with null
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data).toBeNull()
    }
  )
  test.fixme(
    'API-AUTH-ORG-TEAMS-GET-ACTIVE-003: should include team metadata in response',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: User with active team set
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { organization: true } },
      })
      await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })
      const { organization } = await createOrganization({ name: 'Company', slug: 'company' })

      const teamResponse = await page.request.post('/api/auth/organization/create-team', {
        data: { organizationId: organization.id, name: 'Engineering', metadata: { color: 'blue' } },
      })
      const { id: teamId } = await teamResponse.json()

      await page.request.post('/api/auth/organization/set-active-team', {
        data: { teamId },
      })

      // WHEN: User gets active team
      const response = await page.request.get('/api/auth/organization/get-active-team')

      // THEN: Returns team with metadata
      expect(response.status()).toBe(200)
      const team = await response.json()
      expect(team).toHaveProperty('id', teamId)
      expect(team).toHaveProperty('name', 'Engineering')
      expect(team).toHaveProperty('metadata')
    }
  )
  test.fixme(
    'API-AUTH-ORG-TEAMS-GET-ACTIVE-004: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ startServerWithSchema, request }) => {
      // GIVEN: Server without authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { organization: true } },
      })

      // WHEN: Unauthenticated request to get active team
      const response = await request.get('/api/auth/organization/get-active-team')

      // THEN: Should return 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )
  test.fixme('API-AUTH-ORG-TEAMS-GET-ACTIVE-005: placeholder', { tag: '@spec' }, async ({ startServerWithSchema }) => {
      // GIVEN: Placeholder test
      await startServerWithSchema({ name: 'test-app' })

      // WHEN: Placeholder action

      // THEN: Placeholder assertion
      expect(true).toBe(true)
    })
  test.fixme('API-AUTH-ORG-TEAMS-GET-ACTIVE-006: placeholder', { tag: '@spec' }, async ({ startServerWithSchema }) => {
      // GIVEN: Placeholder test
      await startServerWithSchema({ name: 'test-app' })

      // WHEN: Placeholder action

      // THEN: Placeholder assertion
      expect(true).toBe(true)
    })
  test.fixme(
    'API-AUTH-ORG-TEAMS-GET-ACTIVE-007: user can verify active team context persists across requests',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: User with multiple teams
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { organization: true } },
      })
      await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })
      const { organization } = await createOrganization({ name: 'Company', slug: 'company' })

      const team1Response = await page.request.post('/api/auth/organization/create-team', {
        data: { organizationId: organization.id, name: 'Engineering' },
      })
      const { id: team1Id } = await team1Response.json()

      const team2Response = await page.request.post('/api/auth/organization/create-team', {
        data: { organizationId: organization.id, name: 'Design' },
      })
      const { id: team2Id } = await team2Response.json()

      // WHEN/THEN: Initially no active team
      const initialCheck = await page.request.get('/api/auth/organization/get-active-team')
      expect(initialCheck.status()).toBe(200)
      const initialTeam = await initialCheck.json()
      expect(initialTeam).toBeNull()

      // WHEN/THEN: Set first team as active
      const setTeam1 = await page.request.post('/api/auth/organization/set-active-team', {
        data: { teamId: team1Id },
      })
      expect(setTeam1.status()).toBe(200)

      // WHEN/THEN: Verify team 1 is active
      const checkTeam1 = await page.request.get('/api/auth/organization/get-active-team')
      expect(checkTeam1.status()).toBe(200)
      const activeTeam1 = await checkTeam1.json()
      expect(activeTeam1.id).toBe(team1Id)
      expect(activeTeam1.name).toBe('Engineering')

      // WHEN/THEN: Switch to team 2
      const setTeam2 = await page.request.post('/api/auth/organization/set-active-team', {
        data: { teamId: team2Id },
      })
      expect(setTeam2.status()).toBe(200)

      // WHEN/THEN: Verify team 2 is now active
      const checkTeam2 = await page.request.get('/api/auth/organization/get-active-team')
      expect(checkTeam2.status()).toBe(200)
      const activeTeam2 = await checkTeam2.json()
      expect(activeTeam2.id).toBe(team2Id)
      expect(activeTeam2.name).toBe('Design')

      // WHEN/THEN: Active team persists across multiple requests
      for (let i = 0; i < 3; i++) {
        const persistCheck = await page.request.get('/api/auth/organization/get-active-team')
        expect(persistCheck.status()).toBe(200)
        const persistTeam = await persistCheck.json()
        expect(persistTeam.id).toBe(team2Id)
      }
    }
  )
})
