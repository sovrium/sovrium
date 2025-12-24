/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Set Active Team
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('Set Active Team', () => {
  test.fixme(
    'API-AUTH-ORG-TEAMS-SET-ACTIVE-001: should return 200 OK when setting active team',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: User with team membership
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
        data: { organizationId: organization.id, name: 'Team' },
      })
      const { id: teamId } = await teamResponse.json()

      // WHEN: User sets active team
      const response = await page.request.post('/api/auth/organization/set-active-team', {
        data: { teamId },
      })

      // THEN: Returns 200 OK with updated session
      expect(response.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-SET-ACTIVE-002: should update user session with active team context',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: User with organization and team
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
        data: { organizationId: organization.id, name: 'Engineering' },
      })
      const { id: teamId } = await teamResponse.json()

      // WHEN: User sets active team
      const response = await page.request.post('/api/auth/organization/set-active-team', {
        data: { teamId },
      })

      // THEN: Session updated with active team context
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('activeTeamId', teamId)
    }
  )
  test.fixme(
    'API-AUTH-ORG-TEAMS-SET-ACTIVE-003: should return 400 when user not team member',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, addMember, page }) => {
      // GIVEN: User not a member of target team
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

      const memberResponse = await signUp({
        email: 'member@example.com',
        password: 'Pass123!',
        name: 'Member',
      })
      await addMember({
        organizationId: organization.id,
        userId: memberResponse.user.id,
        role: 'member',
      })

      // Switch to member (who is not in the team)
      await page.goto('/login')
      await page.fill('input[name="email"]', 'member@example.com')
      await page.fill('input[name="password"]', 'Pass123!')
      await page.click('button[type="submit"]')

      // WHEN: Non-team-member tries to set active team
      const response = await page.request.post('/api/auth/organization/set-active-team', {
        data: { teamId },
      })

      // THEN: Should return 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('member')
    }
  )
  test.fixme(
    'API-AUTH-ORG-TEAMS-SET-ACTIVE-004: should return 404 when team does not exist',
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

      // WHEN: User tries to set active team to non-existent team
      const response = await page.request.post('/api/auth/organization/set-active-team', {
        data: { teamId: 'non-existent-team-id' },
      })

      // THEN: Should return 404 Not Found
      expect(response.status()).toBe(404)
    }
  )
  test.fixme(
    'API-AUTH-ORG-TEAMS-SET-ACTIVE-005: should return 400 when teamId missing',
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

      // WHEN: User tries to set active team without teamId
      const response = await page.request.post('/api/auth/organization/set-active-team', {
        data: {},
      })

      // THEN: Should return 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('teamId')
    }
  )
  test.fixme(
    'API-AUTH-ORG-TEAMS-SET-ACTIVE-006: should return 401 when not authenticated',
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

      // WHEN: Unauthenticated request to set active team
      const response = await request.post('/api/auth/organization/set-active-team', {
        data: { teamId: 'some-team-id' },
      })

      // THEN: Should return 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )
  test.fixme(
    'API-AUTH-ORG-TEAMS-SET-ACTIVE-007: user can switch between teams and verify context updates',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: User with multiple teams
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

      const team1Response = await page.request.post('/api/auth/organization/create-team', {
        data: { organizationId: organization.id, name: 'Engineering' },
      })
      const { id: team1Id } = await team1Response.json()

      const team2Response = await page.request.post('/api/auth/organization/create-team', {
        data: { organizationId: organization.id, name: 'Design' },
      })
      const { id: team2Id } = await team2Response.json()

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

      // WHEN/THEN: Context persists across requests
      for (let i = 0; i < 3; i++) {
        const persistCheck = await page.request.get('/api/auth/organization/get-active-team')
        expect(persistCheck.status()).toBe(200)
        const persistTeam = await persistCheck.json()
        expect(persistTeam.id).toBe(team2Id)
      }
    }
  )
})
