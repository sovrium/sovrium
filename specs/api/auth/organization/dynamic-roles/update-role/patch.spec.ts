/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Update Custom Role
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('Update Custom Role', () => {
  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-UPDATE-001: should return 200 OK with updated role data',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with custom role
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            dynamicRoles: true,
          },
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@test.com',
        password: 'Password123!',
        createOrganization: true,
      })

      const role = await request
        .post('/api/auth/organization/create-role', {
          data: {
            organizationId: owner.organizationId!,
            name: 'editor',
            permission: ['read:articles'],
          },
        })
        .then((r) => r.json())

      // WHEN: Owner updates role
      const response = await request.patch('/api/auth/organization/update-role', {
        data: {
          organizationId: owner.organizationId!,
          roleId: role.id,
          name: 'content-editor',
          permission: ['read:articles', 'write:articles'],
        },
      })

      // THEN: Returns 200 OK with updated role
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.name).toBe('content-editor')
      expect(data.permission).toContain('write:articles')
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-UPDATE-002: should allow adding/removing individual permissions',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with custom role having multiple permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            dynamicRoles: true,
          },
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@test.com',
        password: 'Password123!',
        createOrganization: true,
      })

      const role = await request
        .post('/api/auth/organization/create-role', {
          data: {
            organizationId: owner.organizationId!,
            name: 'editor',
            permission: ['read:articles', 'write:articles', 'delete:drafts'],
          },
        })
        .then((r) => r.json())

      // WHEN: Owner updates role removing one permission and adding another
      const response = await request.patch('/api/auth/organization/update-role', {
        data: {
          organizationId: owner.organizationId!,
          roleId: role.id,
          permission: ['read:articles', 'write:articles', 'publish:articles'], // Removed delete:drafts, added publish:articles
        },
      })

      // THEN: Permissions should be updated correctly
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.permission).toEqual(['read:articles', 'write:articles', 'publish:articles'])
      expect(data.permission).not.toContain('delete:drafts')
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-UPDATE-003: should return 403 when non-owner tries to update',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request, addMember }) => {
      // GIVEN: Organization with custom role and an admin member
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            dynamicRoles: true,
          },
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@test.com',
        password: 'Password123!',
        createOrganization: true,
      })

      const role = await request
        .post('/api/auth/organization/create-role', {
          data: {
            organizationId: owner.organizationId!,
            name: 'editor',
            permission: ['read:articles'],
          },
        })
        .then((r) => r.json())

      const adminUser = await signUp({
        email: 'admin@test.com',
        password: 'Password123!',
        name: 'Admin',
      })

      await addMember({
        organizationId: owner.organizationId!,
        userId: adminUser.user.id,
        role: 'admin',
      })

      // WHEN: Admin tries to update role (not owner)
      const response = await request.patch('/api/auth/organization/update-role', {
        data: {
          organizationId: owner.organizationId!,
          roleId: role.id,
          name: 'new-name',
        },
        headers: {
          Authorization: `Bearer ${adminUser.session!.token}`,
        },
      })

      // THEN: Should return 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-UPDATE-004: should return 409 when name conflicts',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with two custom roles
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            dynamicRoles: true,
          },
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@test.com',
        password: 'Password123!',
        createOrganization: true,
      })

      const role1 = await request
        .post('/api/auth/organization/create-role', {
          data: {
            organizationId: owner.organizationId!,
            name: 'editor',
            permission: ['read:articles'],
          },
        })
        .then((r) => r.json())

      await request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: owner.organizationId!,
          name: 'viewer',
          permission: ['read:articles'],
        },
      })

      // WHEN: Try to rename role1 to existing 'viewer' name
      const response = await request.patch('/api/auth/organization/update-role', {
        data: {
          organizationId: owner.organizationId!,
          roleId: role1.id,
          name: 'viewer',
        },
      })

      // THEN: Should return 409 Conflict
      expect(response.status()).toBe(409)
      const error = await response.json()
      expect(error.message).toContain('already exists')
    }
  )

  test(
    'API-AUTH-ORG-DYNAMIC-ROLE-UPDATE-005: should return 404 when role not found',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization without the specified role
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            dynamicRoles: true,
          },
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@test.com',
        password: 'Password123!',
        createOrganization: true,
      })

      // WHEN: Try to update non-existent role
      const response = await request.patch('/api/auth/organization/update-role', {
        data: {
          organizationId: owner.organizationId!,
          roleId: 'non-existent-role-id',
          name: 'new-name',
        },
      })

      // THEN: Should return 404 Not Found
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-UPDATE-006: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ startServerWithSchema, request }) => {
      // GIVEN: Server without authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            dynamicRoles: true,
          },
        },
      })

      // WHEN: Unauthenticated request to update role
      const response = await request.patch('/api/auth/organization/update-role', {
        data: {
          organizationId: 'some-org-id',
          roleId: 'some-role-id',
          name: 'new-name',
        },
      })

      // THEN: Should return 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-UPDATE-REGRESSION: owner can update role permissions and verify changes',
    { tag: '@regression' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request, addMember }) => {
      // GIVEN: Organization with custom role and members assigned to it
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            dynamicRoles: true,
          },
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@test.com',
        password: 'Password123!',
        createOrganization: true,
      })

      const role = await request
        .post('/api/auth/organization/create-role', {
          data: {
            organizationId: owner.organizationId!,
            name: 'content-manager',
            permission: ['read:articles', 'write:drafts'],
          },
        })
        .then((r) => r.json())

      // Add members with this role
      const member1 = await signUp({
        email: 'member1@test.com',
        password: 'Password123!',
        name: 'Member 1',
      })
      const { member: m1 } = await addMember({
        organizationId: owner.organizationId!,
        userId: member1.user.id,
      })

      await request.post('/api/auth/organization/assign-role', {
        data: {
          organizationId: owner.organizationId!,
          memberId: m1.id,
          roleId: role.id,
        },
      })

      const member2 = await signUp({
        email: 'member2@test.com',
        password: 'Password123!',
        name: 'Member 2',
      })
      const { member: m2 } = await addMember({
        organizationId: owner.organizationId!,
        userId: member2.user.id,
      })

      await request.post('/api/auth/organization/assign-role', {
        data: {
          organizationId: owner.organizationId!,
          memberId: m2.id,
          roleId: role.id,
        },
      })

      // WHEN: Owner updates role name and permissions
      const updateResponse = await request.patch('/api/auth/organization/update-role', {
        data: {
          organizationId: owner.organizationId!,
          roleId: role.id,
          name: 'senior-content-manager',
          permission: ['read:articles', 'write:drafts', 'publish:articles', 'delete:articles'],
        },
      })

      // THEN: Update should succeed
      expect(updateResponse.status()).toBe(200)
      const updatedRole = await updateResponse.json()
      expect(updatedRole.name).toBe('senior-content-manager')
      expect(updatedRole.permission).toEqual([
        'read:articles',
        'write:drafts',
        'publish:articles',
        'delete:articles',
      ])

      // THEN: Role should appear in roles list with new data
      const roles = await request
        .get('/api/auth/organization/list-roles', {
          params: { organizationId: owner.organizationId! },
        })
        .then((r) => r.json())

      const listedRole = roles.find((r: any) => r.id === role.id)
      expect(listedRole.name).toBe('senior-content-manager')
      expect(listedRole.permission).toEqual([
        'read:articles',
        'write:drafts',
        'publish:articles',
        'delete:articles',
      ])

      // THEN: Members should still have the role (with new name)
      const members = await request
        .get('/api/auth/organization/list-members', {
          params: { organizationId: owner.organizationId! },
        })
        .then((r) => r.json())

      const updatedMember1 = members.find((m: any) => m.id === m1.id)
      expect(updatedMember1.role).toBe('senior-content-manager')

      const updatedMember2 = members.find((m: any) => m.id === m2.id)
      expect(updatedMember2.role).toBe('senior-content-manager')

      // THEN: Members should have updated permissions
      const checkPermission = await request
        .post('/api/auth/organization/check-permission', {
          data: {
            organizationId: owner.organizationId!,
            memberId: m1.id,
            permission: 'publish:articles',
          },
        })
        .then((r) => r.json())

      expect(checkPermission.hasPermission).toBe(true)
    }
  )
})
