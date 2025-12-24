/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin Ban User
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('Admin Ban User', () => {
  test.fixme(
    'API-AUTH-ADMIN-OPT-BAN-001: should return 200 OK when admin bans user',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin user and regular user
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

      // WHEN: Admin bans user
      const response = await page.request.post('/api/auth/admin/ban-user', {
        data: { userId: user.user.id, reason: 'Policy violation' },
      })

      // THEN: Returns 200 OK
      expect(response.status()).toBe(200)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-BAN-002: should prevent banned user from signing in',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Banned user
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

      await page.request.post('/api/auth/admin/ban-user', {
        data: { userId: user.user.id },
      })

      // WHEN: Banned user tries to sign in
      await page.goto('/login')
      await page.fill('input[name="email"]', 'user@example.com')
      await page.fill('input[name="password"]', 'Pass123!')
      await page.click('button[type="submit"]')

      // THEN: Sign in is blocked
      await expect(page.getByText(/banned|suspended/i)).toBeVisible()
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-BAN-003: should invalidate all banned user sessions',
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

      // WHEN: Admin bans user
      await page.request.post('/api/auth/admin/ban-user', {
        data: { userId: user.user.id },
      })

      // THEN: User session is invalidated
      const sessionAfter = await page.request.get('/api/auth/get-session')
      expect(sessionAfter.status()).toBe(401)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-BAN-004: should store ban reason in user record',
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

      // WHEN: Admin bans user with reason
      const banReason = 'Violated terms of service'
      await page.request.post('/api/auth/admin/ban-user', {
        data: { userId: user.user.id, reason: banReason },
      })

      // THEN: Ban reason is stored
      const userResponse = await page.request.get(`/api/auth/admin/get-user?userId=${user.user.id}`)
      expect(userResponse.status()).toBe(200)
      const userData = await userResponse.json()
      expect(userData.banReason).toBe(banReason)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-BAN-005: should return 403 when non-admin tries to ban',
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

      // WHEN: Non-admin tries to ban another user
      const response = await page.request.post('/api/auth/admin/ban-user', {
        data: { userId: user1.user.id },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-BAN-006: should prevent admin from banning self',
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

      // WHEN: Admin tries to ban themselves
      const response = await page.request.post('/api/auth/admin/ban-user', {
        data: { userId: admin.user.id },
      })

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('cannot ban yourself')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-BAN-007: admin can ban user and verify access blocked',
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

      // WHEN/THEN: Ban user
      const banResponse = await page.request.post('/api/auth/admin/ban-user', {
        data: { userId: user.user.id, reason: 'Testing ban workflow' },
      })
      expect(banResponse.status()).toBe(200)

      // WHEN/THEN: Verify user cannot sign in
      await page.goto('/login')
      await page.fill('input[name="email"]', 'user@example.com')
      await page.fill('input[name="password"]', 'Pass123!')
      await page.click('button[type="submit"]')
      await expect(page.getByText(/banned|suspended/i)).toBeVisible()

      // WHEN/THEN: Verify session invalidated
      const sessionCheck = await page.request.get('/api/auth/get-session')
      expect(sessionCheck.status()).toBe(401)
    }
  )
})
