/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Check User Permission
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('Check Permission', () => {
  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-CHECK-PERM-001: should return true when user has permission',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request, addMember, signUp }) => {
      // GIVEN: Organization with custom role and member assigned that role
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
            organizationId: owner.organizationId,
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
          organizationId: owner.organizationId,
          memberId: member.id,
          roleId: role.id,
        },
      })

      // WHEN: Check if member has a permission from their role
      const response = await request.post('/api/auth/organization/check-permission', {
        data: {
          organizationId: owner.organizationId,
          memberId: member.id,
          permission: 'write:articles',
        },
      })

      // THEN: Should return true
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.hasPermission).toBe(true)
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-CHECK-PERM-002: should return false when user lacks permission',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request, addMember, signUp }) => {
      // GIVEN: Organization with custom role and member assigned that role
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
            organizationId: owner.organizationId,
            name: 'reader',
            permissions: ['read:articles'],
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
          organizationId: owner.organizationId,
          memberId: member.id,
          roleId: role.id,
        },
      })

      // WHEN: Check if member has a permission NOT in their role
      const response = await request.post('/api/auth/organization/check-permission', {
        data: {
          organizationId: owner.organizationId,
          memberId: member.id,
          permission: 'delete:articles',
        },
      })

      // THEN: Should return false
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.hasPermission).toBe(false)
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-CHECK-PERM-003: should support resource:action format',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request, addMember, signUp }) => {
      // GIVEN: Organization with custom role using resource:action permission format
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
            organizationId: owner.organizationId,
            name: 'project-manager',
            permissions: ['projects:read', 'projects:write', 'tasks:create'],
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
          organizationId: owner.organizationId,
          memberId: member.id,
          roleId: role.id,
        },
      })

      // WHEN: Check permission using resource:action format
      const response = await request.post('/api/auth/organization/check-permission', {
        data: {
          organizationId: owner.organizationId,
          memberId: member.id,
          permission: 'projects:write',
        },
      })

      // THEN: Should correctly validate the permission
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.hasPermission).toBe(true)
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-CHECK-PERM-004: should include role hierarchy in check',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request, addMember, signUp }) => {
      // GIVEN: Organization with hierarchical roles (admin inherits member permissions)
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

      const adminRole = await request
        .post('/api/auth/organization/create-role', {
          data: {
            organizationId: owner.organizationId,
            name: 'admin',
            permissions: ['read:all', 'write:all', 'delete:all'],
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
          organizationId: owner.organizationId,
          memberId: member.id,
          roleId: adminRole.id,
        },
      })

      // WHEN: Check for various permissions
      const readResponse = await request.post('/api/auth/organization/check-permission', {
        data: {
          organizationId: owner.organizationId,
          memberId: member.id,
          permission: 'read:all',
        },
      })

      const deleteResponse = await request.post('/api/auth/organization/check-permission', {
        data: {
          organizationId: owner.organizationId,
          memberId: member.id,
          permission: 'delete:all',
        },
      })

      // THEN: Should have all assigned permissions
      expect(readResponse.status()).toBe(200)
      expect(deleteResponse.status()).toBe(200)
      const readData = await readResponse.json()
      const deleteData = await deleteResponse.json()
      expect(readData.hasPermission).toBe(true)
      expect(deleteData.hasPermission).toBe(true)
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-CHECK-PERM-005: should return 400 when permission format invalid',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request, addMember, signUp }) => {
      // GIVEN: Organization with a member
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

      const memberUser = await signUp({
        email: 'member@test.com',
        password: 'Password123!',
        name: 'Member',
      })
      const { member } = await addMember({
        organizationId: owner.organizationId!,
        userId: memberUser.user.id,
      })

      // WHEN: Check permission with invalid format
      const response = await request.post('/api/auth/organization/check-permission', {
        data: {
          organizationId: owner.organizationId,
          memberId: member.id,
          permission: '', // Invalid empty permission
        },
      })

      // THEN: Should return 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toBeDefined()
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-CHECK-PERM-006: should return 401 when not authenticated',
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

      // WHEN: Unauthenticated request to check permission
      const response = await request.post('/api/auth/organization/check-permission', {
        data: {
          organizationId: 'some-org-id',
          memberId: 'some-member-id',
          permission: 'read:articles',
        },
      })

      // THEN: Should return 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-CHECK-PERM-007: system can verify permissions across multiple roles',
    { tag: '@regression' },
    async ({ startServerWithSchema, createAuthenticatedUser, request, addMember, signUp }) => {
      // GIVEN: Organization with multiple roles and members
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

      // Create multiple roles with different permissions
      const developerRole = await request
        .post('/api/auth/organization/create-role', {
          data: {
            organizationId: owner.organizationId,
            name: 'developer',
            permissions: ['code:read', 'code:write', 'deploy:staging'],
          },
        })
        .then((r) => r.json())

      const qaRole = await request
        .post('/api/auth/organization/create-role', {
          data: {
            organizationId: owner.organizationId,
            name: 'qa',
            permissions: ['code:read', 'test:execute', 'bugs:report'],
          },
        })
        .then((r) => r.json())

      const adminRole = await request
        .post('/api/auth/organization/create-role', {
          data: {
            organizationId: owner.organizationId,
            name: 'admin',
            permissions: ['*:*'], // All permissions
          },
        })
        .then((r) => r.json())

      // Add members with different roles
      const dev = await signUp({ email: 'dev@test.com', password: 'Password123!', name: 'Dev' })
      const { member: devMember } = await addMember({
        organizationId: owner.organizationId!,
        userId: dev.user.id,
      })

      const qa = await signUp({ email: 'qa@test.com', password: 'Password123!', name: 'QA' })
      const { member: qaMember } = await addMember({
        organizationId: owner.organizationId!,
        userId: qa.user.id,
      })

      const admin = await signUp({
        email: 'admin@test.com',
        password: 'Password123!',
        name: 'Admin',
      })
      const { member: adminMember } = await addMember({
        organizationId: owner.organizationId!,
        userId: admin.user.id,
      })

      // Assign roles
      await request.post('/api/auth/organization/assign-role', {
        data: {
          organizationId: owner.organizationId,
          memberId: devMember.id,
          roleId: developerRole.id,
        },
      })
      await request.post('/api/auth/organization/assign-role', {
        data: { organizationId: owner.organizationId, memberId: qaMember.id, roleId: qaRole.id },
      })
      await request.post('/api/auth/organization/assign-role', {
        data: {
          organizationId: owner.organizationId,
          memberId: adminMember.id,
          roleId: adminRole.id,
        },
      })

      // WHEN/THEN: Verify developer permissions
      const devCodeWrite = await request
        .post('/api/auth/organization/check-permission', {
          data: {
            organizationId: owner.organizationId,
            memberId: devMember.id,
            permission: 'code:write',
          },
        })
        .then((r) => r.json())
      expect(devCodeWrite.hasPermission).toBe(true)

      const devBugsReport = await request
        .post('/api/auth/organization/check-permission', {
          data: {
            organizationId: owner.organizationId,
            memberId: devMember.id,
            permission: 'bugs:report',
          },
        })
        .then((r) => r.json())
      expect(devBugsReport.hasPermission).toBe(false)

      // WHEN/THEN: Verify QA permissions
      const qaTestExecute = await request
        .post('/api/auth/organization/check-permission', {
          data: {
            organizationId: owner.organizationId,
            memberId: qaMember.id,
            permission: 'test:execute',
          },
        })
        .then((r) => r.json())
      expect(qaTestExecute.hasPermission).toBe(true)

      const qaDeployStaging = await request
        .post('/api/auth/organization/check-permission', {
          data: {
            organizationId: owner.organizationId,
            memberId: qaMember.id,
            permission: 'deploy:staging',
          },
        })
        .then((r) => r.json())
      expect(qaDeployStaging.hasPermission).toBe(false)

      // WHEN/THEN: Verify admin has all permissions
      const adminAnyPerm = await request
        .post('/api/auth/organization/check-permission', {
          data: {
            organizationId: owner.organizationId,
            memberId: adminMember.id,
            permission: 'anything:anywhere',
          },
        })
        .then((r) => r.json())
      expect(adminAnyPerm.hasPermission).toBe(true)
    }
  )
})
