/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin Set User Role
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('Admin Set User Role', () => {
  test.fixme(
    'API-AUTH-ADMIN-OPT-SET-ROLE-001: should return 200 OK when admin sets user role',
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

      // WHEN: Admin sets user role
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: { userId: user.user.id, role: 'moderator' },
      })

      // THEN: Returns 200 OK
      expect(response.status()).toBe(200)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-SET-ROLE-002: should apply new role permissions immediately',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: User with default role
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

      // WHEN: Admin changes user role to moderator
      await page.request.post('/api/auth/admin/set-role', {
        data: { userId: user.user.id, role: 'moderator' },
      })

      // THEN: User has moderator permissions immediately
      const userResponse = await page.request.get(`/api/auth/admin/get-user?userId=${user.user.id}`)
      expect(userResponse.status()).toBe(200)
      const userData = await userResponse.json()
      expect(userData.role).toBe('moderator')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-SET-ROLE-003: should return 400 when setting role higher than admin own role',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Moderator admin and regular user
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

      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // WHEN: Moderator tries to set user role to admin (higher than own)
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: { userId: user.user.id, role: 'admin' },
      })

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('higher')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-SET-ROLE-004: should validate role exists before assignment',
    { tag: '@spec' },
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

      // WHEN: Admin tries to set invalid role
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: { userId: user.user.id, role: 'non-existent-role' },
      })

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('role')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-SET-ROLE-005: should log role change event with before/after roles',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin and user with initial role
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
      })
      const admin = await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // WHEN: Admin changes user role
      await page.request.post('/api/auth/admin/set-role', {
        data: { userId: user.user.id, role: 'moderator' },
      })

      // THEN: Role change event is logged
      const logsResponse = await page.request.get('/api/auth/admin/audit-logs')
      expect(logsResponse.status()).toBe(200)
      const logs = await logsResponse.json()
      const roleChangeLog = logs.find((log: any) => log.action === 'set_role')
      expect(roleChangeLog).toBeDefined()
      expect(roleChangeLog.adminId).toBe(admin.user.id)
      expect(roleChangeLog.targetUserId).toBe(user.user.id)
      expect(roleChangeLog.previousRole).toBe('user')
      expect(roleChangeLog.newRole).toBe('moderator')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-SET-ROLE-006: should return 403 when non-admin tries to set role',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Two regular users
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
      })
      const user1 = await signUp({
        email: 'user1@example.com',
        password: 'Pass123!',
        name: 'User 1',
      })
      await signUp({ email: 'user2@example.com', password: 'Pass123!', name: 'User 2' })

      // WHEN: Non-admin tries to set user role
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: { userId: user1.user.id, role: 'admin' },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-SET-ROLE-007: admin can manage user roles across hierarchy',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin and users
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
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

      // WHEN/THEN: Set user1 to moderator
      const setModerator = await page.request.post('/api/auth/admin/set-role', {
        data: { userId: user1.user.id, role: 'moderator' },
      })
      expect(setModerator.status()).toBe(200)

      // WHEN/THEN: Verify role updated
      const user1Data = await page.request
        .get(`/api/auth/admin/get-user?userId=${user1.user.id}`)
        .then((r) => r.json())
      expect(user1Data.role).toBe('moderator')

      // WHEN/THEN: Set user2 to admin
      const setAdmin = await page.request.post('/api/auth/admin/set-role', {
        data: { userId: user2.user.id, role: 'admin' },
      })
      expect(setAdmin.status()).toBe(200)

      // WHEN/THEN: Verify role updated
      const user2Data = await page.request
        .get(`/api/auth/admin/get-user?userId=${user2.user.id}`)
        .then((r) => r.json())
      expect(user2Data.role).toBe('admin')

      // WHEN/THEN: Demote user1 back to user
      const demote = await page.request.post('/api/auth/admin/set-role', {
        data: { userId: user1.user.id, role: 'user' },
      })
      expect(demote.status()).toBe(200)

      // WHEN/THEN: Verify demotion
      const user1Final = await page.request
        .get(`/api/auth/admin/get-user?userId=${user1.user.id}`)
        .then((r) => r.json())
      expect(user1Final.role).toBe('user')
    }
  )
})
