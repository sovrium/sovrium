/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin Delete User
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('Admin Delete User', () => {
  test.fixme(
    'API-AUTH-ADMIN-OPT-DELETE-001: should return 200 OK when admin deletes user',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin and regular user
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // WHEN: Admin deletes user
      const response = await page.request.post('/api/auth/admin/delete-user', {
        data: { userId: user.user.id },
      })

      // THEN: Returns 200 OK
      expect(response.status()).toBe(200)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-DELETE-002: should support soft delete with deleted_at timestamp',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin and regular user
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // WHEN: Admin soft deletes user
      await page.request.post('/api/auth/admin/delete-user', {
        data: { userId: user.user.id, softDelete: true },
      })

      // THEN: User record has deleted_at timestamp
      const userResponse = await page.request.get(`/api/auth/admin/get-user?userId=${user.user.id}`)
      expect(userResponse.status()).toBe(200)
      const userData = await userResponse.json()
      expect(userData.deletedAt).toBeDefined()
      expect(userData.deletedAt).not.toBeNull()
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-DELETE-003: should support hard delete with permanent removal',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin and regular user
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // WHEN: Admin hard deletes user
      await page.request.post('/api/auth/admin/delete-user', {
        data: { userId: user.user.id, hardDelete: true },
      })

      // THEN: User record is completely removed
      const userResponse = await page.request.get(`/api/auth/admin/get-user?userId=${user.user.id}`)
      expect(userResponse.status()).toBe(404)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-DELETE-004: should return 400 when admin tries to delete self',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
      })
      const admin = await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })

      // WHEN: Admin tries to delete themselves
      const response = await page.request.post('/api/auth/admin/delete-user', {
        data: { userId: admin.user.id },
      })

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('cannot delete yourself')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-DELETE-005: should return 403 when deleting user with higher role',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Moderator admin and super admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
      })
      const moderator = await createAdmin({
        email: 'moderator@example.com',
        password: 'Pass123!',
        name: 'Moderator',
      })

      await page.request.post('/api/auth/admin/set-role', {
        data: { userId: moderator.user.id, role: 'moderator' },
      })

      const superAdmin = await signUp({
        email: 'superadmin@example.com',
        password: 'Pass123!',
        name: 'Super Admin',
      })

      await page.request.post('/api/auth/admin/set-role', {
        data: { userId: superAdmin.user.id, role: 'admin' },
      })

      // WHEN: Moderator tries to delete super admin (higher role)
      const response = await page.request.post('/api/auth/admin/delete-user', {
        data: { userId: superAdmin.user.id },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
      const error = await response.json()
      expect(error.message).toContain('higher')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-DELETE-006: should invalidate all user sessions on delete',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: User with active session
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // Verify session is active
      const sessionBefore = await page.request.get('/api/auth/get-session')
      expect(sessionBefore.status()).toBe(200)

      // WHEN: Admin deletes user
      await page.request.post('/api/auth/admin/delete-user', {
        data: { userId: user.user.id },
      })

      // THEN: User session is invalidated
      const sessionAfter = await page.request.get('/api/auth/get-session')
      expect(sessionAfter.status()).toBe(401)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-DELETE-007: admin can delete user and verify complete removal',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin and user
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // WHEN/THEN: Delete user
      const deleteResponse = await page.request.post('/api/auth/admin/delete-user', {
        data: { userId: user.user.id },
      })
      expect(deleteResponse.status()).toBe(200)

      // WHEN/THEN: Verify user cannot sign in
      await page.goto('/login')
      await page.fill('input[name="email"]', 'user@example.com')
      await page.fill('input[name="password"]', 'Pass123!')
      await page.click('button[type="submit"]')
      await expect(page.getByText(/deleted|removed/i)).toBeVisible()

      // WHEN/THEN: Verify session invalidated
      const sessionCheck = await page.request.get('/api/auth/get-session')
      expect(sessionCheck.status()).toBe(401)
    }
  )
})
