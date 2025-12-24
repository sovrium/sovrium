/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin Start Impersonation
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('Admin Start Impersonation', () => {
  test.fixme(
    'API-AUTH-ADMIN-IMPERSONATE-START-001: should return 200 OK when starting impersonation',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request }) => {
      // GIVEN: An admin and a regular user to impersonate
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            admin: {
              impersonation: true,
            },
          },
        },
      })
      await createAuthenticatedUser({
        email: 'admin@example.com',
        password: 'Password123!',
      })

      const targetUser = await signUp({
        email: 'user@example.com',
        password: 'Password123!',
        name: 'Regular User',
      })

      // WHEN: Admin starts impersonating the user
      const response = await request.post('/api/auth/admin/impersonate-user', {
        data: { userId: targetUser.user.id },
      })

      // THEN: Should return 200 OK
      expect(response.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-IMPERSONATE-START-002: should create impersonation session',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request }) => {
      // GIVEN: An admin and target user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            admin: {
              impersonation: true,
            },
          },
        },
      })
      await createAuthenticatedUser({
        email: 'admin@example.com',
        password: 'Password123!',
      })

      const targetUser = await signUp({
        email: 'user@example.com',
        password: 'Password123!',
        name: 'Regular User',
      })

      // WHEN: Admin starts impersonating
      await request.post('/api/auth/admin/impersonate-user', {
        data: { userId: targetUser.user.id },
      })

      // THEN: Session should reflect impersonated user
      const sessionResponse = await request.get('/api/auth/get-session')
      const session = await sessionResponse.json()
      expect(session.user.id).toBe(targetUser.user.id)
      expect(session.user.email).toBe('user@example.com')
      expect(session.impersonating).toBe(true)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-IMPERSONATE-START-003: should preserve admin session',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request }) => {
      // GIVEN: An admin and target user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            admin: {
              impersonation: true,
            },
          },
        },
      })
      const admin = await createAuthenticatedUser({
        email: 'admin@example.com',
        password: 'Password123!',
      })

      const targetUser = await signUp({
        email: 'user@example.com',
        password: 'Password123!',
        name: 'Regular User',
      })

      // WHEN: Admin starts impersonating
      const response = await request.post('/api/auth/admin/impersonate-user', {
        data: { userId: targetUser.user.id },
      })

      // THEN: Response should include original admin info for restoration
      const data = await response.json()
      expect(data.impersonatedBy).toBe(admin.user.id)
      expect(data.originalSession).toBeDefined()
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-IMPERSONATE-START-004: should return 403 when non-admin tries to impersonate',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, signIn, request }) => {
      // GIVEN: A regular user trying to impersonate
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            admin: {
              impersonation: true,
            },
          },
        },
      })
      await signUp({
        email: 'regular@example.com',
        password: 'Password123!',
        name: 'Regular User',
      })
      await signIn({ email: 'regular@example.com', password: 'Password123!' })

      const targetUser = await signUp({
        email: 'target@example.com',
        password: 'Password123!',
        name: 'Target User',
      })

      // WHEN: Non-admin tries to impersonate
      const response = await request.post('/api/auth/admin/impersonate-user', {
        data: { userId: targetUser.user.id },
      })

      // THEN: Should return 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-IMPERSONATE-START-005: should return 404 when target user not found',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: An admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            admin: {
              impersonation: true,
            },
          },
        },
      })
      await createAuthenticatedUser({
        email: 'admin@example.com',
        password: 'Password123!',
      })

      // WHEN: Trying to impersonate non-existent user
      const response = await request.post('/api/auth/admin/impersonate-user', {
        data: { userId: 'non-existent-user-id' },
      })

      // THEN: Should return 404 Not Found
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-IMPERSONATE-START-006: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, request }) => {
      // GIVEN: An unauthenticated request
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            admin: {
              impersonation: true,
            },
          },
        },
      })
      const targetUser = await signUp({
        email: 'target@example.com',
        password: 'Password123!',
        name: 'Target User',
      })

      // WHEN: Trying to impersonate without authentication
      const response = await request.post('/api/auth/admin/impersonate-user', {
        data: { userId: targetUser.user.id },
      })

      // THEN: Should return 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-IMPERSONATE-START-007: admin can impersonate user and perform actions',
    { tag: '@regression' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request }) => {
      // GIVEN: Admin and regular user with organization membership
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            admin: {
              impersonation: true,
            },
          },
        },
      })
      const admin = await createAuthenticatedUser({
        email: 'admin@example.com',
        password: 'Password123!',
      })

      const targetUser = await signUp({
        email: 'user@example.com',
        password: 'Password123!',
        name: 'Regular User',
      })

      // WHEN: Admin impersonates user
      const impersonateResponse = await request.post('/api/auth/admin/impersonate-user', {
        data: { userId: targetUser.user.id },
      })
      expect(impersonateResponse.status()).toBe(200)

      // THEN: Session should be the impersonated user's
      const sessionResponse = await request.get('/api/auth/get-session')
      const session = await sessionResponse.json()
      expect(session.user.id).toBe(targetUser.user.id)
      expect(session.impersonating).toBe(true)
      expect(session.impersonatedBy).toBe(admin.user.id)

      // THEN: Admin actions should be forbidden while impersonating
      const adminActionResponse = await request.get('/api/auth/admin/list-users')
      expect(adminActionResponse.status()).toBe(403)

      // THEN: User-level actions should work
      const profileResponse = await request.get('/api/auth/get-session')
      expect(profileResponse.status()).toBe(200)
    }
  )
})
