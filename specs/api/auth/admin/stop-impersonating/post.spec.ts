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
    async ({
      startServerWithSchema,
      createAuthenticatedUser,
      signUp,
      signIn,
      executeQuery,
      request,
    }) => {
      // GIVEN: Admin currently impersonating a user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: {
            impersonation: true,
          },
        },
      })
      const admin = await createAuthenticatedUser({
        email: 'admin@example.com',
        password: 'Password123!',
      })

      // Manually set admin role via database
      await executeQuery(
        `UPDATE _sovrium_auth_users SET role = 'admin' WHERE id = '${admin.user.id}'`
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
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, signIn, request }) => {
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
      const admin = await createAuthenticatedUser({
        email: 'admin@example.com',
        password: 'Password123!',
      })

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
    async ({
      startServerWithSchema,
      createAuthenticatedUser,
      signUp,
      signIn,
      executeQuery,
      request,
    }) => {
      let admin: Awaited<ReturnType<typeof createAuthenticatedUser>>
      let targetUser: Awaited<ReturnType<typeof signUp>>

      await test.step('Setup: Start server with admin impersonation enabled', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            admin: {
              impersonation: true,
            },
          },
        })
      })

      await test.step('Setup: Create admin and target user', async () => {
        admin = await createAuthenticatedUser({
          email: 'admin@example.com',
          password: 'Password123!',
        })

        await executeQuery(
          `UPDATE _sovrium_auth_users SET role = 'admin' WHERE id = '${admin.user.id}'`
        )

        targetUser = await signUp({
          email: 'user@example.com',
          password: 'Password123!',
          name: 'Regular User',
        })

        await signIn({
          email: 'admin@example.com',
          password: 'Password123!',
        })
      })

      await test.step('API-AUTH-ADMIN-STOP-IMPERSONATING-001: start impersonation returns 200', async () => {
        const startResponse = await request.post('/api/auth/admin/impersonate-user', {
          data: { userId: targetUser.user.id },
        })
        expect(startResponse.status()).toBe(200)
      })

      await test.step('API-AUTH-ADMIN-STOP-IMPERSONATING-002: verify impersonation session', async () => {
        const session = await request.get('/api/auth/get-session').then((r) => r.json())
        expect(session.user.id).toBe(targetUser.user.id)
        expect(session.session.impersonatedBy).toBe(admin.user.id)
      })

      await test.step('API-AUTH-ADMIN-STOP-IMPERSONATING-003: perform action as impersonated user', async () => {
        const profileUpdate = await request.post('/api/auth/update-user', {
          data: { name: 'Updated Name' },
        })
        expect(profileUpdate.status()).toBe(200)
      })

      await test.step('API-AUTH-ADMIN-STOP-IMPERSONATING-004: stop impersonation returns 200', async () => {
        const stopResponse = await request.post('/api/auth/admin/stop-impersonating')
        expect(stopResponse.status()).toBe(200)
      })

      await test.step('API-AUTH-ADMIN-STOP-IMPERSONATING-005: verify admin session restored', async () => {
        await signIn({
          email: 'admin@example.com',
          password: 'Password123!',
        })

        const session = await request.get('/api/auth/get-session').then((r) => r.json())
        expect(session.user.id).toBe(admin.user.id)
        expect(session.session.impersonatedBy).toBeFalsy()
      })

      await test.step('Verify: admin can perform admin actions after stopping impersonation', async () => {
        const adminListResponse = await request.get('/api/auth/admin/list-users')
        expect(adminListResponse.status()).toBe(200)
      })
    }
  )
})
