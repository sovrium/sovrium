/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin List Users
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('Admin List Users', () => {
  test.fixme(
    'API-AUTH-ADMIN-OPT-LIST-001: should return paginated list of users',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin and multiple users
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { admin: true } },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      await signUp({ email: 'user1@example.com', password: 'Pass123!', name: 'User 1' })
      await signUp({ email: 'user2@example.com', password: 'Pass123!', name: 'User 2' })
      await signUp({ email: 'user3@example.com', password: 'Pass123!', name: 'User 3' })

      // WHEN: Admin requests user list with pagination
      const response = await page.request.get('/api/auth/admin/list-users?page=1&limit=2')

      // THEN: Returns paginated users
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.users.length).toBe(2)
      expect(data.total).toBe(4)
      expect(data.page).toBe(1)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-LIST-002: should filter users by role',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin and users with different roles
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { admin: true } },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      await signUp({ email: 'user1@example.com', password: 'Pass123!', name: 'User 1' })
      const moderator = await signUp({
        email: 'moderator@example.com',
        password: 'Pass123!',
        name: 'Moderator',
      })
      await page.request.post('/api/auth/admin/set-role', {
        data: { userId: moderator.user.id, role: 'moderator' },
      })

      // WHEN: Admin filters by moderator role
      const response = await page.request.get('/api/auth/admin/list-users?role=moderator')

      // THEN: Returns only moderators
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.users.length).toBe(1)
      expect(data.users[0].role).toBe('moderator')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-LIST-003: should filter users by status (active/banned)',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin, active user, and banned user
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { admin: true } },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      await signUp({ email: 'active@example.com', password: 'Pass123!', name: 'Active' })
      const bannedUser = await signUp({
        email: 'banned@example.com',
        password: 'Pass123!',
        name: 'Banned',
      })
      await page.request.post('/api/auth/admin/ban-user', {
        data: { userId: bannedUser.user.id },
      })

      // WHEN: Admin filters by banned status
      const response = await page.request.get('/api/auth/admin/list-users?status=banned')

      // THEN: Returns only banned users
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.users.length).toBe(1)
      expect(data.users[0].email).toBe('banned@example.com')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-LIST-004: should search users by email pattern',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin and users with different email domains
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { admin: true } },
      })
      await createAdmin({
        email: 'admin@company.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      await signUp({ email: 'alice@example.com', password: 'Pass123!', name: 'Alice' })
      await signUp({ email: 'bob@example.com', password: 'Pass123!', name: 'Bob' })
      await signUp({ email: 'charlie@other.com', password: 'Pass123!', name: 'Charlie' })

      // WHEN: Admin searches by email pattern
      const response = await page.request.get('/api/auth/admin/list-users?email=example.com')

      // THEN: Returns matching users
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.users.length).toBe(2)
      expect(data.users.every((u: any) => u.email.includes('example.com'))).toBe(true)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-LIST-005: should search users by name pattern',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin and users with different names
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { admin: true } },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      await signUp({ email: 'alice@example.com', password: 'Pass123!', name: 'Alice Johnson' })
      await signUp({ email: 'alex@example.com', password: 'Pass123!', name: 'Alex Smith' })
      await signUp({ email: 'bob@example.com', password: 'Pass123!', name: 'Bob Brown' })

      // WHEN: Admin searches by name pattern
      const response = await page.request.get('/api/auth/admin/list-users?name=Al')

      // THEN: Returns matching users
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.users.length).toBe(2)
      expect(data.users.every((u: any) => u.name.startsWith('Al'))).toBe(true)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-LIST-006: should return 403 when non-admin tries to list',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Regular user (not admin)
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { admin: true } },
      })
      await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // WHEN: Non-admin tries to list users
      const response = await page.request.get('/api/auth/admin/list-users')

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-LIST-007: admin can query users with filters and pagination',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Admin and multiple users with varied attributes
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { admin: true } },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      await signUp({ email: 'alice@example.com', password: 'Pass123!', name: 'Alice' })
      await signUp({ email: 'bob@example.com', password: 'Pass123!', name: 'Bob' })
      await signUp({ email: 'charlie@other.com', password: 'Pass123!', name: 'Charlie' })

      // WHEN/THEN: List all users
      const allUsers = await page.request.get('/api/auth/admin/list-users')
      expect(allUsers.status()).toBe(200)
      const allData = await allUsers.json()
      expect(allData.users.length).toBe(4)

      // WHEN/THEN: Filter by email domain
      const filtered = await page.request.get('/api/auth/admin/list-users?email=example.com')
      expect(filtered.status()).toBe(200)
      const filteredData = await filtered.json()
      expect(filteredData.users.length).toBe(3)

      // WHEN/THEN: Paginate results
      const page1 = await page.request.get('/api/auth/admin/list-users?page=1&limit=2')
      expect(page1.status()).toBe(200)
      const page1Data = await page1.json()
      expect(page1Data.users.length).toBe(2)

      const page2 = await page.request.get('/api/auth/admin/list-users?page=2&limit=2')
      expect(page2.status()).toBe(200)
      const page2Data = await page2.json()
      expect(page2Data.users.length).toBe(2)
    }
  )
})
