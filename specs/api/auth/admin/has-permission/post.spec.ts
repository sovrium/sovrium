/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin Has Permission Check
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('Admin Has Permission', () => {
  test.fixme(
    'API-AUTH-ADMIN-HAS-PERM-001: should return true when admin has permission',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin with specific permission granted
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: {
            customPermissions: {
              posts: ['create', 'read', 'update', 'delete'],
            },
          },
        },
      })
      const admin = await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      await page.request.post('/api/auth/admin/grant-permission', {
        data: { userId: admin.user.id, permissions: ['posts:create'] },
      })

      // WHEN: Checking if admin has the granted permission
      const response = await page.request.post('/api/auth/admin/has-permission', {
        data: { userId: admin.user.id, permission: 'posts:create' },
      })

      // THEN: Returns true
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.hasPermission).toBe(true)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-HAS-PERM-002: should return false when admin lacks permission',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin without specific permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: {
            customPermissions: {
              posts: ['create', 'read', 'update', 'delete'],
            },
          },
        },
      })
      const admin = await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })

      // WHEN: Checking if admin has permission they don't have
      const response = await page.request.post('/api/auth/admin/has-permission', {
        data: { userId: admin.user.id, permission: 'posts:delete' },
      })

      // THEN: Returns false
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.hasPermission).toBe(false)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-HAS-PERM-003: should support wildcard permissions',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: User with wildcard permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: {
            customPermissions: {
              posts: ['*'],
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
      await page.request.post('/api/auth/admin/grant-permission', {
        data: { userId: user.user.id, permissions: ['posts:*'] },
      })

      // WHEN: Checking any action on the resource
      const createResponse = await page.request.post('/api/auth/admin/has-permission', {
        data: { userId: user.user.id, permission: 'posts:create' },
      })
      const deleteResponse = await page.request.post('/api/auth/admin/has-permission', {
        data: { userId: user.user.id, permission: 'posts:delete' },
      })

      // THEN: Wildcard grants all actions
      expect(createResponse.status()).toBe(200)
      expect((await createResponse.json()).hasPermission).toBe(true)
      expect(deleteResponse.status()).toBe(200)
      expect((await deleteResponse.json()).hasPermission).toBe(true)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-HAS-PERM-004: should check resource:action format permissions',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: User with specific resource:action permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: {
            customPermissions: {
              comments: ['create', 'read', 'delete'],
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
      await page.request.post('/api/auth/admin/grant-permission', {
        data: { userId: user.user.id, permissions: ['comments:read'] },
      })

      // WHEN: Checking resource:action permission
      const hasReadResponse = await page.request.post('/api/auth/admin/has-permission', {
        data: { userId: user.user.id, permission: 'comments:read' },
      })
      const hasDeleteResponse = await page.request.post('/api/auth/admin/has-permission', {
        data: { userId: user.user.id, permission: 'comments:delete' },
      })

      // THEN: Returns true for granted permission, false for others
      expect(hasReadResponse.status()).toBe(200)
      expect((await hasReadResponse.json()).hasPermission).toBe(true)
      expect(hasDeleteResponse.status()).toBe(200)
      expect((await hasDeleteResponse.json()).hasPermission).toBe(false)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-HAS-PERM-005: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ startServerWithSchema, request }) => {
      // GIVEN: Server with admin plugin
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
      })

      // WHEN: Unauthenticated user checks permission
      const response = await request.post('/api/auth/admin/has-permission', {
        data: { userId: '1', permission: 'posts:create' },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-HAS-PERM-006: should validate permission string format',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Authenticated admin
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
      })
      const admin = await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })

      // WHEN: Admin submits invalid permission format
      const response = await page.request.post('/api/auth/admin/has-permission', {
        data: { userId: admin.user.id, permission: 'invalid-format-no-colon' },
      })

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('format')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-HAS-PERM-007: system can verify permissions across admin hierarchy',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin and users with varied permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: {
            customPermissions: {
              posts: ['create', 'read', 'update', 'delete'],
              comments: ['create', 'read', 'delete'],
            },
          },
        },
      })
      const admin = await createAdmin({
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

      // WHEN/THEN: Grant permissions
      await page.request.post('/api/auth/admin/grant-permission', {
        data: { userId: user1.user.id, permissions: ['posts:create', 'posts:read'] },
      })
      await page.request.post('/api/auth/admin/grant-permission', {
        data: { userId: user2.user.id, permissions: ['comments:*'] },
      })

      // WHEN/THEN: Verify user1 permissions
      const user1Create = await page.request.post('/api/auth/admin/has-permission', {
        data: { userId: user1.user.id, permission: 'posts:create' },
      })
      expect((await user1Create.json()).hasPermission).toBe(true)

      const user1Delete = await page.request.post('/api/auth/admin/has-permission', {
        data: { userId: user1.user.id, permission: 'posts:delete' },
      })
      expect((await user1Delete.json()).hasPermission).toBe(false)

      // WHEN/THEN: Verify user2 wildcard permissions
      const user2Create = await page.request.post('/api/auth/admin/has-permission', {
        data: { userId: user2.user.id, permission: 'comments:create' },
      })
      expect((await user2Create.json()).hasPermission).toBe(true)

      const user2Delete = await page.request.post('/api/auth/admin/has-permission', {
        data: { userId: user2.user.id, permission: 'comments:delete' },
      })
      expect((await user2Delete.json()).hasPermission).toBe(true)

      // WHEN/THEN: Verify admin has no permissions by default
      const adminCheck = await page.request.post('/api/auth/admin/has-permission', {
        data: { userId: admin.user.id, permission: 'posts:create' },
      })
      expect((await adminCheck.json()).hasPermission).toBe(false)
    }
  )
})
