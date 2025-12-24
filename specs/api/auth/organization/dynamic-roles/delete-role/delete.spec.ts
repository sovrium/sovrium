/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Delete Custom Role
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('Delete Custom Role', () => {
  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-DELETE-001: should return 200 OK when deleting custom role',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with a custom role created
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
            permissions: ['read:articles', 'write:articles'],
          },
        })
        .then((r) => r.json())

      // WHEN: Owner deletes the custom role
      const response = await request.delete('/api/auth/organization/delete-role', {
        data: {
          organizationId: owner.organizationId!,
          roleId: role.id,
        },
      })

      // THEN: Should return 200 OK
      expect(response.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-DELETE-002: should prevent deletion of default roles (owner, admin, member)',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with default roles
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

      // Get default roles
      const roles = await request
        .get('/api/auth/organization/list-roles', {
          params: { organizationId: owner.organizationId! },
        })
        .then((r) => r.json())

      const ownerRole = roles.find((r: any) => r.name === 'owner')

      // WHEN: Try to delete a default role
      const response = await request.delete('/api/auth/organization/delete-role', {
        data: {
          organizationId: owner.organizationId!,
          roleId: ownerRole.id,
        },
      })

      // THEN: Should return 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('Cannot delete default role')
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-DELETE-003: should cascade update members with deleted role',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request, addMember }) => {
      // GIVEN: Organization with custom role assigned to a member
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
            permissions: ['read:articles', 'write:articles'],
          },
        })
        .then((r) => r.json())

      const memberUser = await signUp({
        email: 'member@test.com',
        password: 'Password123!',
        name: 'Member',
      })

      const { member } = await addMember({
        organizationId: owner.organizationId!,
        userId: memberUser.user.id,
      })

      await request.post('/api/auth/organization/assign-role', {
        data: {
          organizationId: owner.organizationId!,
          memberId: member.id,
          roleId: role.id,
        },
      })

      // WHEN: Owner deletes the role
      await request.delete('/api/auth/organization/delete-role', {
        data: {
          organizationId: owner.organizationId!,
          roleId: role.id,
        },
      })

      // THEN: Member should be reverted to default 'member' role
      const members = await request
        .get('/api/auth/organization/list-members', {
          params: { organizationId: owner.organizationId! },
        })
        .then((r) => r.json())

      const updatedMember = members.find((m: any) => m.id === member.id)
      expect(updatedMember.role).toBe('member')
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-DELETE-004: should return 403 when non-owner tries to delete',
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
            permissions: ['read:articles'],
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

      // WHEN: Admin tries to delete role (not owner)
      const response = await request.delete('/api/auth/organization/delete-role', {
        data: {
          organizationId: owner.organizationId!,
          roleId: role.id,
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
    'API-AUTH-ORG-DYNAMIC-ROLE-DELETE-005: should return 404 when role not found',
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

      // WHEN: Try to delete non-existent role
      const response = await request.delete('/api/auth/organization/delete-role', {
        data: {
          organizationId: owner.organizationId!,
          roleId: 'non-existent-role-id',
        },
      })

      // THEN: Should return 404 Not Found
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-DELETE-006: should return 401 when not authenticated',
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

      // WHEN: Unauthenticated request to delete role
      const response = await request.delete('/api/auth/organization/delete-role', {
        data: {
          organizationId: 'some-org-id',
          roleId: 'some-role-id',
        },
      })

      // THEN: Should return 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-DELETE-007: owner can delete role and verify members updated',
    { tag: '@regression' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request, addMember }) => {
      // GIVEN: Organization with multiple custom roles and members
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

      // Create multiple roles
      const editorRole = await request
        .post('/api/auth/organization/create-role', {
          data: {
            organizationId: owner.organizationId!,
            name: 'editor',
            permissions: ['read:articles', 'write:articles'],
          },
        })
        .then((r) => r.json())

      const viewerRole = await request
        .post('/api/auth/organization/create-role', {
          data: {
            organizationId: owner.organizationId!,
            name: 'viewer',
            permissions: ['read:articles'],
          },
        })
        .then((r) => r.json())

      // Add members with roles
      const editor = await signUp({
        email: 'editor@test.com',
        password: 'Password123!',
        name: 'Editor',
      })
      const { member: editorMember } = await addMember({
        organizationId: owner.organizationId!,
        userId: editor.user.id,
      })

      await request.post('/api/auth/organization/assign-role', {
        data: {
          organizationId: owner.organizationId!,
          memberId: editorMember.id,
          roleId: editorRole.id,
        },
      })

      const viewer = await signUp({
        email: 'viewer@test.com',
        password: 'Password123!',
        name: 'Viewer',
      })
      const { member: viewerMember } = await addMember({
        organizationId: owner.organizationId!,
        userId: viewer.user.id,
      })

      await request.post('/api/auth/organization/assign-role', {
        data: {
          organizationId: owner.organizationId!,
          memberId: viewerMember.id,
          roleId: viewerRole.id,
        },
      })

      // WHEN: Owner deletes the editor role
      const deleteResponse = await request.delete('/api/auth/organization/delete-role', {
        data: {
          organizationId: owner.organizationId!,
          roleId: editorRole.id,
        },
      })

      // THEN: Delete should succeed
      expect(deleteResponse.status()).toBe(200)

      // THEN: Editor member should be reverted to default 'member' role
      const members = await request
        .get('/api/auth/organization/list-members', {
          params: { organizationId: owner.organizationId! },
        })
        .then((r) => r.json())

      const updatedEditor = members.find((m: any) => m.id === editorMember.id)
      expect(updatedEditor.role).toBe('member')

      // THEN: Viewer member should retain their role
      const updatedViewer = members.find((m: any) => m.id === viewerMember.id)
      expect(updatedViewer.role).toBe('viewer')

      // THEN: Role should no longer exist in roles list
      const roles = await request
        .get('/api/auth/organization/list-roles', {
          params: { organizationId: owner.organizationId! },
        })
        .then((r) => r.json())

      const deletedRole = roles.find((r: any) => r.id === editorRole.id)
      expect(deletedRole).toBeUndefined()
    }
  )
})
