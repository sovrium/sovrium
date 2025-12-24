/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for List Roles (Default + Custom)
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('List Roles', () => {
  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-LIST-001: should return 200 OK with default and custom roles',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with custom roles created
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

      await request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: owner.organizationId!,
          name: 'editor',
          permissions: ['read:articles', 'write:articles'],
        },
      })

      await request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: owner.organizationId!,
          name: 'viewer',
          permissions: ['read:articles'],
        },
      })

      // WHEN: Request list of roles
      const response = await request.get('/api/auth/organization/list-roles', {
        params: {
          organizationId: owner.organizationId!,
        },
      })

      // THEN: Should return 200 OK with all roles (default + custom)
      expect(response.status()).toBe(200)
      const roles = await response.json()
      expect(Array.isArray(roles)).toBe(true)
      expect(roles.length).toBeGreaterThanOrEqual(5) // owner, admin, member + 2 custom

      const roleNames = roles.map((r: any) => r.name)
      expect(roleNames).toContain('owner')
      expect(roleNames).toContain('admin')
      expect(roleNames).toContain('member')
      expect(roleNames).toContain('editor')
      expect(roleNames).toContain('viewer')
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-LIST-002: should include role permissions in response',
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

      await request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: owner.organizationId!,
          name: 'editor',
          permissions: ['read:articles', 'write:articles', 'delete:drafts'],
        },
      })

      // WHEN: Request list of roles
      const response = await request.get('/api/auth/organization/list-roles', {
        params: {
          organizationId: owner.organizationId!,
        },
      })

      // THEN: Each role should include permissions
      expect(response.status()).toBe(200)
      const roles = await response.json()

      const editorRole = roles.find((r: any) => r.name === 'editor')
      expect(editorRole).toBeDefined()
      expect(editorRole.permissions).toEqual(['read:articles', 'write:articles', 'delete:drafts'])
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-LIST-003: should filter roles by organization',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Two organizations with different custom roles
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            dynamicRoles: true,
          },
        },
      })

      const org1Owner = await createAuthenticatedUser({
        email: 'org1-owner@test.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: org1Owner.organizationId!,
          name: 'org1-editor',
          permissions: ['read:articles'],
        },
      })

      const org2Owner = await createAuthenticatedUser({
        email: 'org2-owner@test.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: org2Owner.organizationId!,
          name: 'org2-editor',
          permissions: ['read:docs'],
        },
      })

      // WHEN: Request roles for org1
      const response = await request.get('/api/auth/organization/list-roles', {
        params: {
          organizationId: org1Owner.organizationId!,
        },
      })

      // THEN: Should only return org1 roles
      expect(response.status()).toBe(200)
      const roles = await response.json()

      const roleNames = roles.map((r: any) => r.name)
      expect(roleNames).toContain('org1-editor')
      expect(roleNames).not.toContain('org2-editor')
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-LIST-004: should return 403 when user not in organization',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Two separate organizations
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            dynamicRoles: true,
          },
        },
      })

      const org1Owner = await createAuthenticatedUser({
        email: 'org1-owner@test.com',
        password: 'Password123!',
        createOrganization: true,
      })

      const org2User = await createAuthenticatedUser({
        email: 'org2-user@test.com',
        password: 'Password123!',
        createOrganization: true,
      })

      // WHEN: org2User tries to list roles from org1
      const response = await request.get('/api/auth/organization/list-roles', {
        params: {
          organizationId: org1Owner.organizationId!,
        },
        headers: {
          Authorization: `Bearer ${org2User.session!.token}`,
        },
      })

      // THEN: Should return 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-LIST-005: should return 400 when organizationId missing',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            dynamicRoles: true,
          },
        },
      })
      await createAuthenticatedUser({
        email: 'owner@test.com',
        password: 'Password123!',
        createOrganization: true,
      })

      // WHEN: Request without organizationId
      const response = await request.get('/api/auth/organization/list-roles')

      // THEN: Should return 400 Bad Request
      expect(response.status()).toBe(400)
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-LIST-006: should return 401 when not authenticated',
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

      // WHEN: Unauthenticated request to list roles
      const response = await request.get('/api/auth/organization/list-roles', {
        params: {
          organizationId: 'some-org-id',
        },
      })

      // THEN: Should return 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-LIST-007: member can view all available roles with permissions',
    { tag: '@regression' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request, addMember }) => {
      // GIVEN: Organization with multiple custom roles and a member user
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

      // Create multiple custom roles
      await request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: owner.organizationId!,
          name: 'admin-editor',
          permissions: ['read:all', 'write:all', 'delete:all'],
        },
      })

      await request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: owner.organizationId!,
          name: 'content-editor',
          permissions: ['read:articles', 'write:articles', 'read:media', 'upload:media'],
        },
      })

      await request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: owner.organizationId!,
          name: 'viewer',
          permissions: ['read:articles', 'read:media'],
        },
      })

      // Add a regular member
      const memberUser = await signUp({
        email: 'member@test.com',
        password: 'Password123!',
        name: 'Member',
      })

      await addMember({
        organizationId: owner.organizationId!,
        userId: memberUser.user.id,
      })

      // WHEN: Member requests list of all roles
      const response = await request.get('/api/auth/organization/list-roles', {
        params: {
          organizationId: owner.organizationId!,
        },
        headers: {
          Authorization: `Bearer ${memberUser.session!.token}`,
        },
      })

      // THEN: Should return all roles with permissions
      expect(response.status()).toBe(200)
      const roles = await response.json()
      expect(roles.length).toBeGreaterThanOrEqual(6) // 3 default + 3 custom

      // Verify default roles
      const ownerRole = roles.find((r: any) => r.name === 'owner')
      expect(ownerRole).toBeDefined()
      expect(ownerRole.permissions).toBeDefined()

      const adminRole = roles.find((r: any) => r.name === 'admin')
      expect(adminRole).toBeDefined()

      const memberRole = roles.find((r: any) => r.name === 'member')
      expect(memberRole).toBeDefined()

      // Verify custom roles with correct permissions
      const adminEditorRole = roles.find((r: any) => r.name === 'admin-editor')
      expect(adminEditorRole.permissions).toEqual(['read:all', 'write:all', 'delete:all'])

      const contentEditorRole = roles.find((r: any) => r.name === 'content-editor')
      expect(contentEditorRole.permissions).toEqual([
        'read:articles',
        'write:articles',
        'read:media',
        'upload:media',
      ])

      const viewerRole = roles.find((r: any) => r.name === 'viewer')
      expect(viewerRole.permissions).toEqual(['read:articles', 'read:media'])
    }
  )
})
