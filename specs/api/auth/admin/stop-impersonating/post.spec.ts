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
 * Spec Count: 6
 */

test.describe('Admin: Stop Impersonating', () => {
  test.fixme(
    'API-AUTH-ADMIN-STOP-IMPERSONATING-001: should return 200 OK when stopping impersonation',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request }) => {
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

  test.fixme(
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

  test.fixme(
    'API-AUTH-ADMIN-STOP-IMPERSONATING-005: should log impersonation end event',
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
      const admin = await createAuthenticatedUser({
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
      const response = await request.post('/api/auth/admin/stop-impersonating')

      // THEN: Response should include audit log info
      const data = await response.json()
      expect(data.auditLog).toBeDefined()
      expect(data.auditLog.event).toBe('impersonation_ended')
      expect(data.auditLog.adminId).toBe(admin.user.id)
      expect(data.auditLog.targetUserId).toBe(targetUser.user.id)
    }
  )

  test(
    'API-AUTH-ADMIN-STOP-IMPERSONATING-006: should return 401 when not authenticated',
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

  test.fixme(
    'API-AUTH-ADMIN-STOP-IMPERSONATING-007: admin can complete impersonation lifecycle',
    { tag: '@regression' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request }) => {
      // GIVEN: Admin and target user
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

      // WHEN: Start impersonation
      const startResponse = await request.post('/api/auth/admin/impersonate-user', {
        data: { userId: targetUser.user.id },
      })
      expect(startResponse.status()).toBe(200)

      // THEN: Verify impersonating as user
      let session = await request.get('/api/auth/get-session').then((r) => r.json())
      expect(session.user.id).toBe(targetUser.user.id)
      expect(session.impersonating).toBe(true)

      // WHEN: Perform some action as impersonated user
      const profileUpdate = await request.patch('/api/auth/update-user', {
        data: { name: 'Updated Name' },
      })
      expect(profileUpdate.status()).toBe(200)

      // WHEN: Stop impersonation
      const stopResponse = await request.post('/api/auth/admin/stop-impersonating')
      expect(stopResponse.status()).toBe(200)

      // THEN: Verify back to admin session
      session = await request.get('/api/auth/get-session').then((r) => r.json())
      expect(session.user.id).toBe(admin.user.id)
      expect(session.impersonating).toBeFalsy()

      // THEN: Verify admin actions work again
      const adminListResponse = await request.get('/api/auth/admin/list-users')
      expect(adminListResponse.status()).toBe(200)

      // THEN: Verify target user's update persisted
      const targetUserData = await request
        .get('/api/auth/admin/get-user', {
          params: { userId: targetUser.user.id },
        })
        .then((r) => r.json())
      expect(targetUserData.name).toBe('Updated Name')
    }
  )
})
