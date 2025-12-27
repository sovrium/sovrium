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
    'API-AUTH-ORG-OPT-CREATOR-003: should return 400 when demoting creator below owner',
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
    'API-AUTH-ORG-OPT-CREATOR-007: system can manage creator role lifecycle',
    { tag: '@regression' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request, addMember }) => {
      // GIVEN: Organization with creator and multiple members
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

      const admin = await signUp({
        email: 'admin@example.com',
        password: 'Password123!',
        name: 'Admin User',
      })
      await addMember({
        organizationId: creator.organizationId!,
        userId: admin.user.id,
        role: 'admin',
      })

      const member = await signUp({
        email: 'member@example.com',
        password: 'Password123!',
        name: 'Regular Member',
      })
      await addMember({
        organizationId: creator.organizationId!,
        userId: member.user.id,
        role: 'member',
      })

      // WHEN/THEN: Verify creator is owner
      const members = await request
        .get('/api/auth/organization/list-members', {
          params: { organizationId: creator.organizationId! },
        })
        .then((r) => r.json())

      const creatorMember = members.find((m: any) => m.userId === creator.user.id)
      expect(creatorMember.role).toBe('owner')

      // WHEN/THEN: Creator can manage organization
      const updateResponse = await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: creator.organizationId!,
          name: 'Updated Company Name',
        },
      })
      expect(updateResponse.status()).toBe(200)

      // WHEN/THEN: Creator can create custom roles
      const createRoleResponse = await request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: creator.organizationId!,
          name: 'editor',
          permissions: ['read:content', 'write:content'],
        },
      })
      expect(createRoleResponse.status()).toBe(200)

      // WHEN/THEN: Creator can delete organization
      const deleteResponse = await request.delete('/api/auth/organization/delete', {
        data: { organizationId: creator.organizationId! },
      })
      expect(deleteResponse.status()).toBe(200)

      // WHEN/THEN: Organization should no longer exist
      const getOrgResponse = await request.get('/api/auth/organization/get-details', {
        params: { organizationId: creator.organizationId! },
      })
      expect(getOrgResponse.status()).toBe(404)
    }
  )
})
