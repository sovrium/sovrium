/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin Unban User
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('Admin Unban User', () => {
  test.fixme(
    'API-AUTH-ADMIN-OPT-UNBAN-001: should return 200 OK when admin unbans user',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Banned user
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { admin: true } },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      await page.request.post('/api/auth/admin/ban-user', {
        data: { userId: user.user.id },
      })

      // WHEN: Admin unbans user
      const response = await page.request.post('/api/auth/admin/unban-user', {
        data: { userId: user.user.id },
      })

      // THEN: Returns 200 OK
      expect(response.status()).toBe(200)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-UNBAN-002: should allow unbanned user to sign in',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Previously banned user that was unbanned
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { admin: true } },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      await page.request.post('/api/auth/admin/ban-user', {
        data: { userId: user.user.id },
      })
      await page.request.post('/api/auth/admin/unban-user', {
        data: { userId: user.user.id },
      })

      // WHEN: Unbanned user tries to sign in
      await page.goto('/login')
      await page.fill('input[name="email"]', 'user@example.com')
      await page.fill('input[name="password"]', 'Pass123!')
      await page.click('button[type="submit"]')

      // THEN: Sign in succeeds
      await expect(page).toHaveURL('/dashboard')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-UNBAN-003: should clear ban reason from user record',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Banned user with reason
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { admin: true } },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      await page.request.post('/api/auth/admin/ban-user', {
        data: { userId: user.user.id, reason: 'Policy violation' },
      })

      // WHEN: Admin unbans user
      await page.request.post('/api/auth/admin/unban-user', {
        data: { userId: user.user.id },
      })

      // THEN: Ban reason is cleared
      const userResponse = await page.request.get(`/api/auth/admin/get-user?userId=${user.user.id}`)
      expect(userResponse.status()).toBe(200)
      const userData = await userResponse.json()
      expect(userData.banReason).toBeNull()
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-UNBAN-004: should return 400 when unbanning non-banned user',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Regular non-banned user
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { admin: true } },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // WHEN: Admin tries to unban non-banned user
      const response = await page.request.post('/api/auth/admin/unban-user', {
        data: { userId: user.user.id },
      })

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('not banned')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-UNBAN-005: should return 403 when non-admin tries to unban',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Banned user and regular user
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { admin: true } },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const bannedUser = await signUp({
        email: 'banned@example.com',
        password: 'Pass123!',
        name: 'Banned',
      })

      await page.request.post('/api/auth/admin/ban-user', {
        data: { userId: bannedUser.user.id },
      })

      await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // WHEN: Non-admin tries to unban user
      const response = await page.request.post('/api/auth/admin/unban-user', {
        data: { userId: bannedUser.user.id },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-UNBAN-006: should log unban event with admin details',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Banned user
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { admin: true } },
      })
      const admin = await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      await page.request.post('/api/auth/admin/ban-user', {
        data: { userId: user.user.id },
      })

      // WHEN: Admin unbans user
      await page.request.post('/api/auth/admin/unban-user', {
        data: { userId: user.user.id },
      })

      // THEN: Unban event is logged with admin details
      const logsResponse = await page.request.get('/api/auth/admin/audit-logs')
      expect(logsResponse.status()).toBe(200)
      const logs = await logsResponse.json()
      const unbanLog = logs.find((log: any) => log.action === 'unban_user')
      expect(unbanLog).toBeDefined()
      expect(unbanLog.adminId).toBe(admin.user.id)
      expect(unbanLog.targetUserId).toBe(user.user.id)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-UNBAN-007: admin can complete ban/unban lifecycle',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin and user
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { admin: true } },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // WHEN/THEN: Ban user
      const banResponse = await page.request.post('/api/auth/admin/ban-user', {
        data: { userId: user.user.id, reason: 'Testing lifecycle' },
      })
      expect(banResponse.status()).toBe(200)

      // WHEN/THEN: Verify user cannot sign in
      await page.goto('/login')
      await page.fill('input[name="email"]', 'user@example.com')
      await page.fill('input[name="password"]', 'Pass123!')
      await page.click('button[type="submit"]')
      await expect(page.getByText(/banned|suspended/i)).toBeVisible()

      // WHEN/THEN: Unban user
      const unbanResponse = await page.request.post('/api/auth/admin/unban-user', {
        data: { userId: user.user.id },
      })
      expect(unbanResponse.status()).toBe(200)

      // WHEN/THEN: Verify user can sign in after unban
      await page.goto('/login')
      await page.fill('input[name="email"]', 'user@example.com')
      await page.fill('input[name="password"]', 'Pass123!')
      await page.click('button[type="submit"]')
      await expect(page).toHaveURL('/dashboard')
    }
  )
})
