/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test } from '@/specs/fixtures'

/**
 * E2E Tests for Remove Member from Team
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('Remove Team Member', () => {
  test.fixme(
    'API-AUTH-ORG-TEAMS-REMOVE-MEMBER-001: should return 200 OK when owner removes member from team',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      signUp,
      createOrganization,
      inviteMember,
      acceptInvitation,
      page,
    }) => {
      // GIVEN: Team with a member
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { organization: true } },
      })

      await signUp({ email: 'owner@example.com', password: 'Pass123!', name: 'Owner' })
      const { organization } = await createOrganization({ name: 'Company', slug: 'company' })

      const teamResponse = await page.request.post('/api/auth/organization/create-team', {
        data: { organizationId: organization.id, name: 'Team' },
      })
      const { id: teamId } = await teamResponse.json()

      await inviteMember({
        organizationId: organization.id,
        email: 'member@example.com',
        role: 'member',
      })
      await signUp({ email: 'member@example.com', password: 'Pass123!', name: 'Member' })
      const memberAccept = await acceptInvitation({
        organizationId: organization.id,
        email: 'member@example.com',
      })

      await page.request.post('/api/auth/organization/add-team-member', {
        data: { teamId, userId: memberAccept.member.userId },
      })

      // WHEN: Owner removes member from team
      const response = await page.request.delete('/api/auth/organization/remove-team-member', {
        data: { teamId, userId: memberAccept.member.userId },
      })

      // THEN: Returns 200 OK
      expect(response.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-ORG-TEAMS-REMOVE-MEMBER-002: should return 403 when non-owner tries to remove member',
    { tag: '@spec' },
    async () => {}
  )
  test.fixme(
    'API-AUTH-ORG-TEAMS-REMOVE-MEMBER-003: should return 400 when user is not team member',
    { tag: '@spec' },
    async () => {}
  )
  test.fixme(
    'API-AUTH-ORG-TEAMS-REMOVE-MEMBER-004: should return 404 when team does not exist',
    { tag: '@spec' },
    async () => {}
  )
  test.fixme(
    'API-AUTH-ORG-TEAMS-REMOVE-MEMBER-005: should return 400 when userId or teamId missing',
    { tag: '@spec' },
    async () => {}
  )
  test.fixme(
    'API-AUTH-ORG-TEAMS-REMOVE-MEMBER-006: should return 401 when not authenticated',
    { tag: '@spec' },
    async () => {}
  )
  test.fixme(
    'API-AUTH-ORG-TEAMS-REMOVE-MEMBER-007: owner can remove multiple members and verify removal',
    { tag: '@regression' },
    async () => {}
  )
})
