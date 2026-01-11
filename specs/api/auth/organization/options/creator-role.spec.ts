/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Organization Creator Role
 *
 * Domain: api
 * Spec Count: 2
 */

test.describe('Organization Creator Role', () => {
  test.fixme(
    'API-AUTH-ORG-OPT-CREATOR-001: should assign owner role to organization creator',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: User creates a new organization
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
      })
      const creator = await createAuthenticatedUser({
        email: 'creator@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      // WHEN: Check creator's role in the organization
      const members = await request
        .get('/api/auth/organization/list-members', {
          params: { organizationId: creator.organizationId! },
        })
        .then((r) => r.json())

      const creatorMember = members.find((m: any) => m.userId === creator.user.id)

      // THEN: Creator should have owner role
      expect(creatorMember).toBeDefined()
      expect(creatorMember.role).toBe('owner')
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-CREATOR-002: should return 400 when demoting creator below owner',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      createAuthenticatedUser,
      signUp: _signUp,
      request,
      addMember: _addMember,
    }) => {
      // GIVEN: Organization with creator as owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
      })
      const creator = await createAuthenticatedUser({
        email: 'creator@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      const members = await request
        .get('/api/auth/organization/list-members', {
          params: { organizationId: creator.organizationId! },
        })
        .then((r) => r.json())

      const creatorMember = members.find((m: any) => m.userId === creator.user.id)

      // WHEN: Try to demote creator to member
      const response = await request.patch('/api/auth/organization/update-member-role', {
        data: {
          organizationId: creator.organizationId!,
          memberId: creatorMember.id,
          role: 'member',
        },
      })

      // THEN: Should return 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('creator')
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-CREATOR-REGRESSION: system can manage creator role lifecycle',
    { tag: '@regression' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      let creator: Awaited<ReturnType<typeof createAuthenticatedUser>>
      let creatorMemberId: string

      await test.step('Setup: Start server with comprehensive configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            organization: true,
          },
        })

        creator = await createAuthenticatedUser({
          email: 'creator@example.com',
          password: 'Password123!',
          createOrganization: true,
        })
      })

      await test.step('API-AUTH-ORG-OPT-CREATOR-001: Assigns owner role to organization creator', async () => {
        // WHEN: Check creator's role in the organization
        const members = await request
          .get('/api/auth/organization/list-members', {
            params: { organizationId: creator.organizationId! },
          })
          .then((r) => r.json())

        const creatorMember = members.find((m: any) => m.userId === creator.user.id)
        creatorMemberId = creatorMember.id

        // THEN: Creator should have owner role
        expect(creatorMember).toBeDefined()
        expect(creatorMember.role).toBe('owner')
      })

      await test.step('API-AUTH-ORG-OPT-CREATOR-002: Returns 400 when demoting creator below owner', async () => {
        // WHEN: Try to demote creator to member
        const response = await request.patch('/api/auth/organization/update-member-role', {
          data: {
            organizationId: creator.organizationId!,
            memberId: creatorMemberId,
            role: 'member',
          },
        })

        // THEN: Should return 400 Bad Request
        expect(response.status()).toBe(400)
        const error = await response.json()
        expect(error.message).toContain('creator')
      })
    }
  )
})
