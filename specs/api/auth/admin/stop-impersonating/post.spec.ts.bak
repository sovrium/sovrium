/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin: Stop Impersonating
 *
 * Endpoint: POST /api/auth/admin/stop-impersonating
 * Better Auth Admin Plugin: stopImpersonation
 * Domain: api
 * Spec Count: 5
 */

test.describe('Admin: Stop Impersonating', () => {
  test(
    'API-AUTH-ADMIN-STOP-IMPERSONATING-001: should return 200 OK when stopping impersonation',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, signIn, request }) => {
      // GIVEN: Admin currently impersonating a user
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            admin: {
              impersonation: true,
            },
          },
        },
        {
          adminBootstrap: {
            email: 'admin@example.com',
            password: 'Password123!',
            name: 'Admin User',
          },
        }
      )

      const targetUser = await signUp({
        email: 'user@example.com',
        password: 'Password123!',
        name: 'Regular User',
      })

      // Re-establish admin session (signUp switched to target user's session)
      await signIn({
        email: 'admin@example.com',
        password: 'Password123!',
      })

      await request.post('/api/auth/admin/impersonate-user', {
        data: { userId: targetUser.user.id },
      })

      // WHEN: Admin stops impersonating
      const response = await request.post('/api/auth/admin/stop-impersonating')

      // THEN: Should return 200 OK
      expect(response.status()).toBe(200)
    }
  )

  test(
    'API-AUTH-ADMIN-STOP-IMPERSONATING-002: should restore admin session',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, signIn, request }) => {
      // GIVEN: Admin impersonating a user
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            admin: {
              impersonation: true,
            },
          },
        },
        {
          adminBootstrap: {
            email: 'admin@example.com',
            password: 'Password123!',
            name: 'Admin User',
          },
        }
      )

      const targetUser = await signUp({
        email: 'user@example.com',
        password: 'Password123!',
        name: 'Regular User',
      })

      // Re-establish admin session (signUp switched to target user's session)
      const admin = await signIn({
        email: 'admin@example.com',
        password: 'Password123!',
      })

      await request.post('/api/auth/admin/impersonate-user', {
        data: { userId: targetUser.user.id },
      })

      // WHEN: Admin stops impersonating
      await request.post('/api/auth/admin/stop-impersonating')

      // THEN: Session should be restored to admin
      const sessionResponse = await request.get('/api/auth/get-session')
      const session = await sessionResponse.json()
      expect(session.user.id).toBe(admin.user.id)
      expect(session.user.email).toBe('admin@example.com')
      expect(session.impersonating).toBeFalsy()
    }
  )

  test(
    'API-AUTH-ADMIN-STOP-IMPERSONATING-003: should terminate impersonation session',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request }) => {
      // GIVEN: Admin impersonating a user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: {
            impersonation: true,
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

      await request.post('/api/auth/admin/impersonate-user', {
        data: { userId: targetUser.user.id },
      })

      // WHEN: Admin stops impersonating
      await request.post('/api/auth/admin/stop-impersonating')

      // THEN: Impersonation session metadata should be cleared
      const sessionResponse = await request.get('/api/auth/get-session')
      const session = await sessionResponse.json()
      expect(session.impersonatedBy).toBeUndefined()
      expect(session.originalSession).toBeUndefined()
    }
  )

  test(
    'API-AUTH-ADMIN-STOP-IMPERSONATING-004: should return 400 when not impersonating',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Admin not currently impersonating anyone
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: {
            impersonation: true,
          },
        },
      })
      await createAuthenticatedUser({
        email: 'admin@example.com',
        password: 'Password123!',
      })

      // WHEN: Trying to stop impersonation when not impersonating
      const response = await request.post('/api/auth/admin/stop-impersonating')

      // THEN: Should return 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('not impersonating')
    }
  )

  test(
    'API-AUTH-ADMIN-STOP-IMPERSONATING-005: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ startServerWithSchema, request }) => {
      // GIVEN: An unauthenticated request
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: {
            impersonation: true,
          },
        },
      })

      // WHEN: Trying to stop impersonation without authentication
      const response = await request.post('/api/auth/admin/stop-impersonating')

      // THEN: Should return 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test(
    'API-AUTH-ADMIN-STOP-IMPERSONATING-REGRESSION: admin impersonation lifecycle workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp, signIn, request }) => {
      // Setup: Start server with admin impersonation enabled
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            admin: {
              impersonation: true,
            },
          },
        },
        {
          adminBootstrap: {
            email: 'admin@example.com',
            password: 'Password123!',
            name: 'Admin User',
          },
        }
      )

      await test.step('API-AUTH-ADMIN-STOP-IMPERSONATING-005: Returns 401 when not authenticated', async () => {
        // WHEN: Trying to stop impersonation without authentication
        const response = await request.post('/api/auth/admin/stop-impersonating')

        // THEN: Should return 401 Unauthorized
        expect(response.status()).toBe(401)
      })

      // Setup: Create target user
      const targetUser = await signUp({
        email: 'user@example.com',
        password: 'Password123!',
        name: 'Regular User',
      })

      // Re-establish admin session (signUp switched to target user's session)
      const admin = await signIn({
        email: 'admin@example.com',
        password: 'Password123!',
      })

      await test.step('API-AUTH-ADMIN-STOP-IMPERSONATING-004: Returns 400 when not impersonating', async () => {
        // WHEN: Trying to stop impersonation when not impersonating
        const response = await request.post('/api/auth/admin/stop-impersonating')

        // THEN: Should return 400 Bad Request
        expect(response.status()).toBe(400)
        const error = await response.json()
        expect(error.message).toContain('not impersonating')
      })

      // Start impersonation for next tests
      await request.post('/api/auth/admin/impersonate-user', {
        data: { userId: targetUser.user.id },
      })

      await test.step('API-AUTH-ADMIN-STOP-IMPERSONATING-001: Returns 200 OK when stopping impersonation', async () => {
        // WHEN: Admin stops impersonating
        const response = await request.post('/api/auth/admin/stop-impersonating')

        // THEN: Should return 200 OK
        expect(response.status()).toBe(200)
      })

      // Restart impersonation to test session restoration
      await signIn({
        email: 'admin@example.com',
        password: 'Password123!',
      })
      await request.post('/api/auth/admin/impersonate-user', {
        data: { userId: targetUser.user.id },
      })

      await test.step('API-AUTH-ADMIN-STOP-IMPERSONATING-002: Restores admin session', async () => {
        // WHEN: Admin stops impersonating
        await request.post('/api/auth/admin/stop-impersonating')

        // THEN: Session should be restored to admin
        const sessionResponse = await request.get('/api/auth/get-session')
        const session = await sessionResponse.json()
        expect(session.user.id).toBe(admin.user.id)
        expect(session.user.email).toBe('admin@example.com')
        expect(session.impersonating).toBeFalsy()
      })
    }
  )
})
