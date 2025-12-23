/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin Custom Resource:Action Permissions
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('Admin Custom Resource:Action Permissions', () => {
  test.fixme(
    'API-AUTH-ADMIN-CUSTOM-PERM-001: should define custom resource permissions',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Server with custom resource permissions configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            admin: {
              customPermissions: {
                posts: ['create', 'read', 'update', 'delete'],
                comments: ['create', 'read', 'delete'],
              },
            },
          },
        },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })

      // WHEN: Admin retrieves custom permissions
      const response = await page.request.get('/api/auth/admin/permissions')

      // THEN: Returns custom resource permissions
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.resources).toContain('posts')
      expect(data.resources).toContain('comments')
      expect(data.permissions.posts).toEqual(['create', 'read', 'update', 'delete'])
      expect(data.permissions.comments).toEqual(['create', 'read', 'delete'])
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-CUSTOM-PERM-002: should support multiple actions per resource',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin and user with multiple custom permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            admin: {
              customPermissions: {
                posts: ['create', 'read', 'update', 'delete', 'publish'],
              },
            },
          },
        },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // WHEN: Admin assigns multiple permissions to user
      const response = await page.request.post('/api/auth/admin/grant-permission', {
        data: {
          userId: user.user.id,
          permissions: ['posts:create', 'posts:read', 'posts:update'],
        },
      })

      // THEN: All permissions are granted
      expect(response.status()).toBe(200)
      const checkResponse = await page.request.get(
        `/api/auth/admin/user-permissions?userId=${user.user.id}`
      )
      const permissions = await checkResponse.json()
      expect(permissions.permissions).toContain('posts:create')
      expect(permissions.permissions).toContain('posts:read')
      expect(permissions.permissions).toContain('posts:update')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-CUSTOM-PERM-003: should enforce resource:action format',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin and user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            admin: {
              customPermissions: {
                posts: ['create', 'read'],
              },
            },
          },
        },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // WHEN: Admin tries to grant permission with invalid format
      const response = await page.request.post('/api/auth/admin/grant-permission', {
        data: {
          userId: user.user.id,
          permissions: ['invalid-format'],
        },
      })

      // THEN: Returns 400 Bad Request with format error
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('resource:action')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-CUSTOM-PERM-004: should allow wildcard actions',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin and user with wildcard permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            admin: {
              customPermissions: {
                posts: ['*'],
              },
            },
          },
        },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // WHEN: Admin grants wildcard permission
      await page.request.post('/api/auth/admin/grant-permission', {
        data: {
          userId: user.user.id,
          permissions: ['posts:*'],
        },
      })

      // THEN: User can perform all actions on resource
      const hasCreateResponse = await page.request.post('/api/auth/admin/has-permission', {
        data: { userId: user.user.id, permission: 'posts:create' },
      })
      expect(hasCreateResponse.status()).toBe(200)
      expect((await hasCreateResponse.json()).hasPermission).toBe(true)

      const hasDeleteResponse = await page.request.post('/api/auth/admin/has-permission', {
        data: { userId: user.user.id, permission: 'posts:delete' },
      })
      expect(hasDeleteResponse.status()).toBe(200)
      expect((await hasDeleteResponse.json()).hasPermission).toBe(true)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-CUSTOM-PERM-005: should deny access without explicit permission',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: User without specific permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            admin: {
              customPermissions: {
                posts: ['create', 'read', 'update', 'delete'],
              },
            },
          },
        },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // WHEN: Checking permission user doesn't have
      const response = await page.request.post('/api/auth/admin/has-permission', {
        data: { userId: user.user.id, permission: 'posts:delete' },
      })

      // THEN: Returns false for permission check
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.hasPermission).toBe(false)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-CUSTOM-PERM-006: should validate action against allowed actions',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin and user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            admin: {
              customPermissions: {
                posts: ['create', 'read'],
              },
            },
          },
        },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // WHEN: Admin tries to grant permission with invalid action
      const response = await page.request.post('/api/auth/admin/grant-permission', {
        data: {
          userId: user.user.id,
          permissions: ['posts:invalidAction'],
        },
      })

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('action')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-CUSTOM-PERM-007: system can manage custom permissions across resources',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin and multiple users with varied permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            admin: {
              customPermissions: {
                posts: ['create', 'read', 'update', 'delete'],
                comments: ['create', 'read', 'delete'],
                media: ['upload', 'delete'],
              },
            },
          },
        },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user1 = await signUp({
        email: 'user1@example.com',
        password: 'Pass123!',
        name: 'User 1',
      })
      const user2 = await signUp({
        email: 'user2@example.com',
        password: 'Pass123!',
        name: 'User 2',
      })

      // WHEN/THEN: Grant permissions to user1
      const grant1 = await page.request.post('/api/auth/admin/grant-permission', {
        data: { userId: user1.user.id, permissions: ['posts:create', 'posts:read'] },
      })
      expect(grant1.status()).toBe(200)

      // WHEN/THEN: Grant permissions to user2
      const grant2 = await page.request.post('/api/auth/admin/grant-permission', {
        data: { userId: user2.user.id, permissions: ['comments:*', 'media:upload'] },
      })
      expect(grant2.status()).toBe(200)

      // WHEN/THEN: Verify user1 permissions
      const check1 = await page.request.get(
        `/api/auth/admin/user-permissions?userId=${user1.user.id}`
      )
      const perms1 = await check1.json()
      expect(perms1.permissions).toContain('posts:create')
      expect(perms1.permissions).toContain('posts:read')

      // WHEN/THEN: Verify user2 permissions
      const check2 = await page.request.get(
        `/api/auth/admin/user-permissions?userId=${user2.user.id}`
      )
      const perms2 = await check2.json()
      expect(perms2.permissions).toContain('comments:*')
      expect(perms2.permissions).toContain('media:upload')

      // WHEN/THEN: Revoke permission from user1
      const revoke = await page.request.post('/api/auth/admin/revoke-permission', {
        data: { userId: user1.user.id, permissions: ['posts:create'] },
      })
      expect(revoke.status()).toBe(200)

      const checkAfterRevoke = await page.request.get(
        `/api/auth/admin/user-permissions?userId=${user1.user.id}`
      )
      const permsAfter = await checkAfterRevoke.json()
      expect(permsAfter.permissions).not.toContain('posts:create')
      expect(permsAfter.permissions).toContain('posts:read')
    }
  )
})
